"""
update_data.py — pulls your leaderboard CSV from a PRIVATE GitHub repo and
bakes it directly into src/AgentAdvisor.jsx as an embedded JavaScript
constant. The raw CSV never touches your public repo -- only the resulting
numbers, compiled into the JS bundle.

Setup (one-time):
  1. Create a private GitHub repo (e.g. "agent-advisor-data") containing
     leaderboard_combined.csv
  2. Create a GitHub Personal Access Token with "repo" scope:
     https://github.com/settings/tokens
  3. Set two environment variables before running this script:
       export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
       export DATA_REPO="your-username/agent-advisor-data"

Usage (run from inside your agent-advisor project folder):
    python update_data.py

Then commit and deploy as usual:
    git add src/AgentAdvisor.jsx
    git commit -m "Update leaderboard data"
    npm run deploy
"""
import base64
import os
import re
import sys
import urllib.request
import json

TOKEN = os.environ.get("GITHUB_TOKEN")
DATA_REPO = os.environ.get("DATA_REPO")          # e.g. "yourname/agent-advisor-data"
CSV_PATH_IN_REPO = os.environ.get("DATA_CSV_PATH", "leaderboard_combined.csv")
COMPONENT_FILE = os.environ.get(
    "COMPONENT_FILE", "src/AgentAdvisor.jsx"
)

BEGIN_MARKER = "// === EMBEDDED_DATA_START ==="
END_MARKER = "// === EMBEDDED_DATA_END ==="


def fetch_private_csv():
    if not TOKEN or not DATA_REPO:
        print("ERROR: set GITHUB_TOKEN and DATA_REPO environment variables first.")
        print('  export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"')
        print('  export DATA_REPO="your-username/agent-advisor-data"')
        sys.exit(1)

    url = f"https://api.github.com/repos/{DATA_REPO}/contents/{CSV_PATH_IN_REPO}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "agent-advisor-updater",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"ERROR fetching CSV: {e.code} {e.reason}")
        print("Check that GITHUB_TOKEN has 'repo' scope and DATA_REPO is correct.")
        sys.exit(1)

    content = base64.b64decode(data["content"]).decode("utf-8")
    return content


def escape_for_js_template(csv_text):
    """Escape characters that would break a JS template literal."""
    return csv_text.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def update_component_file(csv_text):
    if not os.path.exists(COMPONENT_FILE):
        print(f"ERROR: {COMPONENT_FILE} not found. Run this from your project root,")
        print("or set COMPONENT_FILE to the correct path.")
        sys.exit(1)

    with open(COMPONENT_FILE) as f:
        content = f.read()

    escaped = escape_for_js_template(csv_text)
    new_block = (
        f"{BEGIN_MARKER}\n"
        f"const SAMPLE_CSV = `{escaped}`;\n"
        f"{END_MARKER}"
    )

    if BEGIN_MARKER in content and END_MARKER in content:
        pattern = re.compile(
            re.escape(BEGIN_MARKER) + r".*?" + re.escape(END_MARKER), re.DOTALL
        )
        content = pattern.sub(new_block, content)
        print("Updated existing embedded data block.")
    else:
        # First-time setup: replace the original `const SAMPLE_CSV = \`...\`;`
        # declaration with the marked, script-managed version.
        pattern = re.compile(
            r"const SAMPLE_CSV = `.*?`;", re.DOTALL
        )
        if not pattern.search(content):
            print("ERROR: could not find the SAMPLE_CSV constant to replace.")
            print("Add these markers manually around it once, then re-run:")
            print(f"  {BEGIN_MARKER}")
            print("  const SAMPLE_CSV = `...`;")
            print(f"  {END_MARKER}")
            sys.exit(1)
        content = pattern.sub(new_block, content, count=1)
        print("Embedded data block created (first run).")

    with open(COMPONENT_FILE, "w") as f:
        f.write(content)


def main():
    print(f"Fetching {CSV_PATH_IN_REPO} from private repo {DATA_REPO} ...")
    csv_text = fetch_private_csv()
    row_count = len(csv_text.strip().splitlines()) - 1
    print(f"Fetched {row_count} data rows.")

    update_component_file(csv_text)

    print()
    print(f"Done. {COMPONENT_FILE} now contains your latest results.")
    print("Next steps:")
    print(f"  git add {COMPONENT_FILE}")
    print('  git commit -m "Update leaderboard data"')
    print("  npm run deploy")


if __name__ == "__main__":
    main()
