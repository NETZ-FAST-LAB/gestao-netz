import os

from dotenv import load_dotenv
from github import Github

load_dotenv()

token = os.getenv("GITHUB_TOKEN")
if not token:
    raise ValueError("Missing GITHUB_TOKEN in environment.")

g = Github(token)
try:
    org = g.get_organization("NETZ-FAST-LAB")
    for repo in org.get_repos():
        print(repo.name, repo.html_url)
except Exception as e:
    print(e)
