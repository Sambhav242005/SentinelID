import secrets  # Add this import
import string
from openai import OpenAI
import re
from models import ChoiceLog
from config import Config, config  # Make sure config has MODEL_NAME defined
import json
from playwright.sync_api import sync_playwright
from urllib.parse import quote
import hashlib
from typing import Tuple, Dict, Any
import sys
import requests
import csv
import os

# Initialize OpenAI client with OpenRouter
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=config.OPENROUTER_API_KEY,
    default_headers={
        "X-Title": "SentinelID - Identity Manager",
    },
)


def generate_random_password(length=16):
    """Generate secure random password"""
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(chars) for _ in range(length))


def classify_behavior(prompt):
    """Classify tab behavior using LLM"""
    try:
        response = client.chat.completions.create(
            model=config.MODEL_NAME,  # Ensure this is defined in config.py
            messages=[
                {
                    "role": "system",
                    "content": "You are a cybersecurity expert. Classify web behavior as GOOD (legitimate) or BAD (malicious).",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=10,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"AI Classification Error: {str(e)}")
        return "UNKNOWN"


def sort_emails(email_content):
    """Categorize emails using AI (manual JSON mode for all models)"""
    try:
        response = client.chat.completions.create(
            model=config.MODEL_NAME,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an AI email classifier. "
                        "Categorize the email as one of: IMPORTANT, SPAM, or LEAK. "
                        'Respond ONLY in strict JSON format, e.g.: {"category": "SPAM"}. '
                        "Do not include explanations or reasoning."
                    ),
                },
                {"role": "user", "content": f"Email content:\n{email_content}"},
            ],
            max_tokens=50,
            temperature=0.3,
        )

        print(json.dumps(response.model_dump(), indent=2))  # full API response

        content = response.choices[0].message.content.strip()
        if not content:
            raise ValueError("Empty model content received")

        # Try parsing JSON output
        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            # If model includes text before/after JSON, extract it
            import re

            match = re.search(r"\{.*\}", content, re.DOTALL)
            result = (
                json.loads(match.group(0)) if match else {"category": "UNCATEGORIZED"}
            )

        return result

    except Exception as e:
        print(f"Email Sorting Error: {str(e)}")
        return {"category": "UNCATEGORIZED"}


def summarize_incident(details):
    """Generate plain-language incident summaries"""
    try:
        response = client.chat.completions.create(
            model=config.MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": "Summarize security incidents in simple English for non-experts.",
                },
                {"role": "user", "content": details},
            ],
            max_tokens=150,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Incident Summary Error: {str(e)}")
        return "Summary unavailable"


def check_email_breach(email):
    """
    Check if an email has been in breaches using HIBP's public search with Playwright.
    No API key required.
    Returns:
        dict: {'found': bool, 'breach_count': int, 'paste_count': int, 'breaches': list, 'pastes': list}
        None: If error occurred
    """
    try:
        with sync_playwright() as p:
            encoded_email = quote(email)
            url = f"https://haveibeenpwned.com/unifiedsearch/{encoded_email}"

            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            # Set user agent
            page.set_extra_http_headers(
                {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            )

            # Navigate to the page
            response = page.goto(url, wait_until="networkidle", timeout=10000)

            if response.status == 200:
                # Extract the page content
                content = page.content()

                # Extract JSON from the <pre> tag
                json_match = re.search(r"<pre>(.*?)</pre>", content, re.DOTALL)

                if json_match:
                    json_str = json_match.group(1)
                    data = json.loads(json_str)

                    # Extract breaches and pastes
                    breaches = data.get("Breaches", [])
                    pastes = data.get("Pastes", [])

                    browser.close()

                    return {
                        "found": len(breaches) > 0,
                        "breach_count": len(breaches),
                        "paste_count": len(pastes) if pastes else 0,
                        "breaches": breaches,
                        "pastes": pastes if pastes else [],
                    }
                else:
                    print("Could not extract JSON from page")
                    browser.close()
                    return None

            elif response.status == 404:
                browser.close()
                # No breaches found
                return {
                    "found": False,
                    "breach_count": 0,
                    "paste_count": 0,
                    "breaches": [],
                    "pastes": [],
                }
            else:
                print(f"HIBP returned status code: {response.status}")
                browser.close()
                return None

    except Exception as e:
        print(f"Error checking breach: {e}")
        return None


def check_hibp_api(password: str, timeout: float = 10.0) -> Tuple[bool, int]:
    """
    Checks a password against the HIBP Pwned Passwords API (v2)
    using k-anonymity.

    This method is secure as the full password is never sent.

    Returns (is_pwned, count)
    - is_pwned: True if the password hash suffix was found in the API response
    - count: times seen (0 if not found)
    """
    if not password:
        raise ValueError("password required")

    # 1. Calculate the SHA-1 hash of the password
    sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()

    # 2. Split the hash for k-anonymity
    # The API only needs the first 5 characters (prefix).
    prefix = sha1[:5]
    suffix = sha1[5:]

    # 3. Query the API range endpoint
    url = f"https://api.pwnedpasswords.com/range/{prefix}"

    try:
        resp = requests.get(url, headers={"User-Agent": DEFAULT_UA}, timeout=timeout)
    except requests.RequestException as e:
        # If the network fails, we can't confirm, so we treat it as "not pwned"
        # but print an error.
        print(f"Network error checking HIBP: {e}", file=sys.stderr)
        return False, 0

    # 4. Process the response
    # 404 means the 5-char prefix was not found in any breached passwords.
    # This is the "best" possible outcome, as it means it's not even
    # in the database with other similar hashes.
    if resp.status_code == 404:
        return False, 0

    if resp.status_code != 200:
        # Any other error means we can't be sure.
        print(f"Error from HIBP API: status {resp.status_code}", file=sys.stderr)
        return False, 0

    # 5. Check the list of suffixes returned by the API.
    # The response is plain text, e.g.:
    # 0018A45C4D1DEF81644B54AB7F969B88D65:3
    # 00D4F6E8FA6EECAD2A384D41A49598894DA:1

    # We iterate through the lines to find our *suffix*.
    for line in resp.text.splitlines():
        try:
            line_suffix, count_str = line.split(":")
            if line_suffix == suffix:
                # We found a match!
                return True, int(count_str)
        except ValueError:
            # Ignore any malformed lines
            continue

    # If we finish the loop without finding our suffix, the password is safe.
    return False, 0


# --- Utility Function ---
def write_to_csv(log_entry: ChoiceLog):
    """
    Appends a new log entry to the CSV file.
    Creates the file and writes headers if it doesn't exist.
    """
    file_exists = os.path.isfile(config.LOG_FILE)

    with open(config.LOG_FILE, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=Config.CSV_FIELDS)

        if not file_exists:
            writer.writeheader()  # Write headers if new file

        # Convert the log_entry to a dictionary compatible with CSV_FIELDS
        row_data = {
            "user_id": log_entry.user_id,
            "session_id": log_entry.session_id,
            "choice": log_entry.choice.value,
            "features": str(log_entry.features),  # Store dict as a string
        }
        writer.writerow(row_data)
