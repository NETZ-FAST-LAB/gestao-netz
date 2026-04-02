import glob
import re

for f in glob.glob('Bot/*.py'):
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    
    new_content = re.sub(r'from Bot\.([a-zA-Z0-9_]+) import', r'from \1 import', content)
    new_content = re.sub(r'import Bot\.([a-zA-Z0-9_]+)', r'import \1', new_content)
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(new_content)
        
print("Fixed successfully!")
