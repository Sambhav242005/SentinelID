import hashlib
import requests
import sys
from typing import Tuple

# The User-Agent is still good practice for any API client
DEFAULT_UA = "my-password-checker/1.0"


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


# Example usage:
if __name__ == "__main__":
    pw = input("Password to check: ").strip()

    if not pw:
        print("No password provided.")
        sys.exit(1)

    try:
        # The API returns (pwned_status, count)
        # There is no HTML "snippet".
        pwned, count = check_hibp_api(pw)

        if pwned:
            print(f"\nPWNED! ❌")
            print(f"This password has been seen {count:,} times in data breaches.")
            print("You should NOT use this password anywhere.")
        else:
            print(f"\nSAFE! ✅")
            print("This password was not found in the HIBP database.")

    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
