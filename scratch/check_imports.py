import os
import re

def check_motion_imports(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.tsx'):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if 'motion.' in content or '<motion' in content:
                        if 'from "framer-motion"' not in content and "from 'framer-motion'" not in content:
                            print(f"File missing framer-motion import: {path}")

if __name__ == "__main__":
    check_motion_imports('client/src')
