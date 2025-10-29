# python -m pip install playwright
# python -m playwright install chromium
from playwright.sync_api import sync_playwright
from urllib.parse import quote
import json
import re

email = "sambhav242005@gmail.com"

with sync_playwright() as p:
    encoded_email = quote(email)
    url = f"https://haveibeenpwned.com/unifiedsearch/{encoded_email}"

    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    page.goto(url)

    # Wait for content to load
    page.wait_for_load_state("networkidle")

    # Extract the page content
    content = page.content()

    # Extract JSON from the <pre> tag
    # The JSON is inside <pre> tags in the HTML
    json_match = re.search(r"<pre>(.*?)</pre>", content, re.DOTALL)

    if json_match:
        json_str = json_match.group(1)
        # Parse the JSON
        data = json.loads(json_str)

        # Pretty print the JSON
        print(json.dumps(data, indent=2))

        # Optionally save to file
        with open("hibp_results.json", "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print("\n" + "=" * 50)
        print(f"Email: {email}")
        print(f"Total breaches found: {len(data.get('Breaches', []))}")
        print("=" * 50)

        # Print breach names
        if data.get("Breaches"):
            print("\nBreaches:")
            for breach in data["Breaches"]:
                print(f"  - {breach['Title']} ({breach['BreachDate']})")
    else:
        print("Could not find JSON data in page")
        print(content)

    browser.close()
