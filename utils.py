import secrets  # Add this import
import string
from openai import OpenAI
import re
from config import config  # Make sure config has MODEL_NAME defined
import json
from playwright.sync_api import sync_playwright
from urllib.parse import quote

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


# import json


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
