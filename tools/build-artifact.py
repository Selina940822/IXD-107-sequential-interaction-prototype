"""Write the Claude artifact version of the root index.html.

The artifact host wraps the page in its own <html>/<head>/<body>, so this keeps
everything else identical and only removes those outer tags (the <title>,
<link> and <style> tags move to the top of the page body, where they still apply).
CSS, JS and assets are published next to it unchanged, at the same relative paths.

    python3 tools/build-artifact.py <out-dir>
"""
import re, sys, pathlib

out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
html = pathlib.Path(__file__).resolve().parent.parent.joinpath('index.html').read_text()
head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)
head = re.sub(r'\s*<meta charset[^>]*>|\s*<meta name="viewport"[^>]*>', '', head)
(out / 'index.html').write_text(head.strip() + '\n' + body.strip() + '\n')
print(out / 'index.html')
