import secrets
import string
from openai import OpenAI
import re
from models import ChoiceLog
from config import Config, config
import json
from playwright.sync_api import sync_playwright
from urllib.parse import quote
import hashlib
from typing import Tuple,  Any
import sys
import requests
import csv
import os

# Provide a default user agent for requests usage
DEFAULT_UA = "SentinelID/1.0 (+https://example.com) Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

# Initialize OpenAI client with OpenRouter
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=config.OPENROUTER_API_KEY,
)


def generate_random_password(length=16):
    chars = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(chars) for _ in range(length))


def classify_behavior(prompt):
    try:
        response = client.chat.completions.create(
            model=config.MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": "You are a cybersecurity expert. Classify web behavior as GOOD (legitimate) or BAD (malicious).",
                },
                {"role": "user", "content": prompt},
            ],
            max_tokens=10,
        )
        # Normalise the returned text
        text = response.choices[0].message.content.strip().upper() if response.choices[0].message.content else ""
        if text.startswith("GOOD"):
            return "GOOD"
        if text.startswith("BAD"):
            return "BAD"
        return text
    except Exception as e:
        print(f"AI Classification Error: {str(e)}")
        return "UNKNOWN"


def sort_emails(email_content):
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

        # debug print of raw model dump is OK in dev
        try:
            print(json.dumps(response.model_dump(), indent=2))
        except Exception:
            pass
        content = response.choices[0].message.content.strip() if response.choices[0].message.content else ""
        if not content:
            raise ValueError("Empty model content received")

        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", content, re.DOTALL)
            result = json.loads(match.group(0)) if match else {"category": "UNCATEGORIZED"}

        return result

    except Exception as e:
        print(f"Email Sorting Error: {str(e)}")
        return {"category": "UNCATEGORIZED"}


def summarize_incident(details):
    try:
        response = client.chat.completions.create(
            model=config.MODEL_NAME,
            messages=[
                {"role": "system", "content": "Summarize security incidents in simple English for non-experts."},
                {"role": "user", "content": details},
            ],
            max_tokens=150,
        )
        content = response.choices[0].message.content
        return content.strip() if content else ""
    except Exception as e:
        print(f"Incident Summary Error: {str(e)}")
        return "Summary unavailable"


def check_email_breach(email):
    try:
        with sync_playwright() as p:
            encoded_email = quote(email)
            url = f"https://haveibeenpwned.com/unifiedsearch/{encoded_email}"

            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.set_extra_http_headers({"User-Agent": DEFAULT_UA})

            response = page.goto(url, wait_until="networkidle", timeout=15000)
            if response is None:
                browser.close()
                return None

            status = response.status
            if status == 200:
                content = page.content()
                json_match = re.search(r"<pre>(.*?)</pre>", content, re.DOTALL)
                if json_match:
                    json_str = json_match.group(1)
                    data = json.loads(json_str)
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
                    # HIBP has changed layout or blocked scraping
                    browser.close()
                    print("Could not extract JSON from HIBP page (layout may have changed)")
                    return None
            elif status == 404:
                browser.close()
                return {"found": False, "breach_count": 0, "paste_count": 0, "breaches": [], "pastes": []}
            else:
                browser.close()
                print(f"HIBP returned status code: {status}")
                return None
    except Exception as e:
        print(f"Error checking breach: {e}")
        return None


def check_hibp_api(password: str, timeout: float = 10.0) -> Tuple[bool, int]:
    if not password:
        raise ValueError("password required")

    sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix = sha1[:5]
    suffix = sha1[5:]
    url = f"https://api.pwnedpasswords.com/range/{prefix}"

    try:
        resp = requests.get(url, headers={"User-Agent": DEFAULT_UA}, timeout=timeout)
    except requests.RequestException as e:
        print(f"Network error checking HIBP: {e}", file=sys.stderr)
        return False, 0

    if resp.status_code == 404 or resp.status_code == 204:
        return False, 0

    if resp.status_code != 200:
        print(f"Error from HIBP API: status {resp.status_code}", file=sys.stderr)
        return False, 0

    for line in resp.text.splitlines():
        try:
            line_suffix, count_str = line.split(":")
            if line_suffix == suffix:
                return True, int(count_str)
        except ValueError:
            continue

    return False, 0


def write_to_csv(log_entry: Any):
    """
    Accept either a ChoiceLog instance or a dict-like object with keys:
    user_id, session_id, choice, features.
    """
    file_exists = os.path.isfile(config.LOG_FILE)

    with open(config.LOG_FILE, mode="a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=Config.CSV_FIELDS)

        if not file_exists:
            writer.writeheader()

        if isinstance(log_entry, ChoiceLog):
            row_data = {
                "user_id": log_entry.user_id,
                "session_id": log_entry.session_id,
                "choice": getattr(log_entry.choice, "value", str(log_entry.choice)),
                "features": str(log_entry.features),
            }
        elif isinstance(log_entry, dict):
            row_data = {
                "user_id": log_entry.get("user_id"),
                "session_id": log_entry.get("session_id"),
                "choice": log_entry.get("choice"),
                "features": str(log_entry.get("features", "")),
            }
        else:
            # Fallback: attempt to coerce attributes
            row_data = {
                "user_id": getattr(log_entry, "user_id", None),
                "session_id": getattr(log_entry, "session_id", None),
                "choice": getattr(log_entry, "choice", None),
                "features": str(getattr(log_entry, "features", "")),
            }

        writer.writerow(row_data)


def correlate_leak_to_session(leak_info, session_data, alias_data=None):
    """
    Correlate a detected leak to a specific user session
    Returns correlation confidence score and factors
    """
    correlation_factors = {
        "time_proximity": 0.0,
        "site_match": 0.0,
        "user_match": 0.0,
        "alias_match": 0.0,
        "behavioral_indicators": []
    }
    
    confidence = 0.0
    
    # Time proximity analysis
    if leak_info.get('detected_at') and session_data.get('start_time'):
        # Simple time-based correlation (in a real implementation, this would be more sophisticated)
        time_diff = abs((leak_info['detected_at'] - session_data['start_time']).total_seconds())
        if time_diff < 3600:  # Within 1 hour
            correlation_factors['time_proximity'] = 0.8
            correlation_factors['behavioral_indicators'].append("Leak detected within 1 hour of session")
        elif time_diff < 86400:  # Within 24 hours
            correlation_factors['time_proximity'] = 0.4
            correlation_factors['behavioral_indicators'].append("Leak detected within 24 hours of session")
        else:
            correlation_factors['time_proximity'] = 0.1
    
    # Site match analysis
    if leak_info.get('breach_source') and session_data.get('tabs'):
        breach_domain = leak_info['breach_source'].split('//')[-1].split('/')[0].lower()
        session_domains = [tab['url'].split('//')[-1].split('/')[0].lower() 
                          for tab in session_data.get('tabs', [])]
        
        if breach_domain in session_domains:
            correlation_factors['site_match'] = 0.9
            correlation_factors['behavioral_indicators'].append(f"User visited breach site: {breach_domain}")
        else:
            # Check for similar domains
            for session_domain in session_domains:
                if breach_domain in session_domain or session_domain in breach_domain:
                    correlation_factors['site_match'] = 0.6
                    correlation_factors['behavioral_indicators'].append(f"Similar domain found: {session_domain}")
                    break
    
    # User match analysis
    if leak_info.get('alias_id') and alias_data:
        correlation_factors['user_match'] = 1.0
        correlation_factors['behavioral_indicators'].append("Leak linked to user's alias")
    
    # Calculate overall confidence
    confidence = (
        correlation_factors['time_proximity'] * 0.3 +
        correlation_factors['site_match'] * 0.4 +
        correlation_factors['user_match'] * 0.3
    )
    
    return {
        "confidence": min(confidence, 1.0),
        "factors": correlation_factors
    }