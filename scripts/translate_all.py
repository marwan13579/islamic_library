#!/usr/bin/env python3
"""Install Argos translation packages and translate Islamic Library locale files."""
import os, sys, json, time

# Add site-packages to path
site_pkgs = '/home/abokhaled/.local/lib/python3.14/site-packages'
sys.path.insert(0, site_pkgs)

from argostranslate import package, translate

# Language code mapping: locale_dir -> argos_code
LANG_MAP = {
    'de': 'de', 'es': 'es', 'fr': 'fr', 'it': 'it',
    'pt': 'pt', 'nl': 'nl', 'pl': 'pl', 'sv': 'sv',
    'no': 'nb', 'da': 'da', 'fi': 'fi', 'el': 'el',
    'cs': 'cs', 'ro': 'ro', 'hu': 'hu', 'uk': 'uk',
    'ru': 'ru', 'tr': 'tr', 'fa': 'fa', 'ur': 'ur',
    'id': 'id', 'bn': 'bn', 'ms': 'ms', 'hi': 'hi',
    'sw': 'sw', 'th': 'th', 'vi': 'vi', 'ja': 'ja',
    'ko': 'ko', 'zh-CN': 'zh', 'zh-TW': 'zt',
}

ROOT = '/home/abokhaled/Downloads/islamic_library'
LOCALES = os.path.join(ROOT, 'locales')
EN_DIR = os.path.join(LOCALES, 'en')
MODULES = sorted([f for f in os.listdir(EN_DIR) if f.endswith('.json')])

def install_packages():
    """Install needed translation packages."""
    packages = package.get_available_packages()
    needed = set(LANG_MAP.values())
    installed = set()
    
    # Check what's already installed
    for lang in translate.get_installed_languages():
        installed.add(lang.code)
    
    print(f"Already installed: {sorted(installed)}")
    
    for p in packages:
        if p.from_code == 'en' and p.to_code in needed and p.to_code not in installed:
            try:
                print(f"Installing en->{p.to_code} ({p.to_name})...", flush=True)
                p.install()
                installed.add(p.to_code)
                print(f"  OK", flush=True)
                time.sleep(0.5)
            except Exception as e:
                print(f"  FAILED: {e}", flush=True)
    
    return installed

def translate_text(text, translator):
    """Translate a single text string."""
    if not text or not isinstance(text, str) or not text.strip():
        return text
    if len(text) > 1000:
        return text
    try:
        result = translator.translate(text)
        return result if result else text
    except:
        return text

def translate_value(value, translator):
    """Recursively translate a JSON value."""
    if isinstance(value, str):
        return translate_text(value, translator)
    elif isinstance(value, list):
        return [translate_value(v, translator) for v in value]
    elif isinstance(value, dict):
        return {k: translate_value(v, translator) for k, v in value.items()}
    else:
        return value

def translate_locale(lang_code, argos_code):
    """Translate all modules for a locale."""
    locale_dir = os.path.join(LOCALES, lang_code)
    
    # Get translator
    try:
        from argostranslate import translate as argos_tr
        translator_obj = argos_tr.get_translation_from_codes('en', argos_code)
        if not translator_obj:
            print(f"  No translator for en->{argos_code}")
            return False
    except Exception as e:
        print(f"  Translator error: {e}")
        return False
    
    print(f"\n=== Translating {lang_code} ({argos_code}) ===", flush=True)
    
    for module in MODULES:
        src_path = os.path.join(EN_DIR, module)
        dest_path = os.path.join(locale_dir, module)
        
        if not os.path.exists(dest_path):
            print(f"  {module}: missing dest file, skip")
            continue
        
        with open(src_path, 'r', encoding='utf-8') as f:
            src_data = json.load(f)
        with open(dest_path, 'r', encoding='utf-8') as f:
            dest_data = json.load(f)
        
        # Check if already translated
        src_sample = json.dumps(src_data, ensure_ascii=False)[:200]
        dest_sample = json.dumps(dest_data, ensure_ascii=False)[:200]
        
        if src_sample == dest_sample:
            print(f"  {module}: translating...", flush=True, end='')
            translated = translate_value(src_data, translator_obj)
            # Preserve _meta
            if '_meta' in dest_data:
                translated['_meta'] = dest_data['_meta']
            with open(dest_path, 'w', encoding='utf-8') as f:
                json.dump(translated, f, ensure_ascii=False, indent=2)
                f.write('\n')
            print(' done', flush=True)
        else:
            print(f"  {module}: already translated, skip", flush=True)
    
    return True

def main():
    print("=== Step 1: Install packages ===", flush=True)
    installed = install_packages()
    print(f"\nInstalled: {sorted(installed)}", flush=True)
    
    print("\n=== Step 2: Translate locales ===", flush=True)
    
    # Only translate locales that need it (currently English copies)
    for lang_code, argos_code in LANG_MAP.items():
        if argos_code not in installed:
            print(f"\nSKIP {lang_code}: package not installed")
            continue
        
        # Check if already translated
        en_file = os.path.join(EN_DIR, 'common.json')
        lang_file = os.path.join(LOCALES, lang_code, 'common.json')
        if not os.path.exists(lang_file):
            continue
        
        with open(en_file, 'r', encoding='utf-8') as f:
            en_data = json.load(f)
        with open(lang_file, 'r', encoding='utf-8') as f:
            lang_data = json.load(f)
        
        en_sample = json.dumps(en_data, ensure_ascii=False)[:200]
        lang_sample = json.dumps(lang_data, ensure_ascii=False)[:200]
        
        if en_sample != lang_sample:
            print(f"\nSKIP {lang_code}: already translated")
            continue
        
        translate_locale(lang_code, argos_code)
    
    print("\n=== DONE ===", flush=True)

if __name__ == '__main__':
    main()