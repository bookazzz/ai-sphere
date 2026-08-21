#!/usr/bin/env python3
"""Parse RSS/Atom feeds — fast version with strict timeouts"""
import json, os, re, sys, time, urllib.request, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, TimeoutError
import socket
socket.setdefaulttimeout(8)

CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.json')

def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)

def load_seen(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}

def save_seen(path, seen):
    with open(path, 'w') as f:
        json.dump(seen, f, indent=2)

def fetch_url(url, timeout=8):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Sphere/1.0; +https://ai-sphere.ru)'
    })
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.read()
    except:
        return None

def parse_rss(xml_data):
    items = []
    try:
        root = ET.fromstring(xml_data)
        for item in root.iter('item'):
            entry = {'title': '', 'link': '', 'description': ''}
            for child in item:
                tag = child.tag.split('}')[-1]
                if tag == 'title' and child.text:
                    entry['title'] = child.text.strip()
                elif tag == 'link' and child.text:
                    entry['link'] = child.text.strip()
                elif tag == 'description' and child.text:
                    entry['description'] = re.sub(r'<[^>]+>', '', child.text).strip()[:500]
            if entry['link']:
                items.append(entry)
    except:
        pass
    return items

def parse_atom(xml_data):
    items = []
    NS = {'atom': 'http://www.w3.org/2005/Atom'}
    try:
        root = ET.fromstring(xml_data)
        for entry in root.findall('atom:entry', NS):
            item = {'title': '', 'link': '', 'description': ''}
            t = entry.find('atom:title', NS)
            if t is not None and t.text:
                item['title'] = t.text.strip()
            l = entry.find('atom:link', NS)
            if l is not None:
                item['link'] = l.get('href', '')
            c = entry.find('atom:content', NS)
            if c is not None and c.text:
                item['description'] = re.sub(r'<[^>]+>', '', c.text).strip()[:500]
            else:
                s = entry.find('atom:summary', NS)
                if s is not None and s.text:
                    item['description'] = re.sub(r'<[^>]+>', '', s.text).strip()[:500]
            if item['link']:
                items.append(item)
    except:
        pass
    return items

def is_ai_related(title, desc):
    t = f"{title} {desc}".lower()
    kws = ['ai','llm','language model','gpt','claude','gemini','chatgpt',
           'openai','anthropic','deepmind','llama','mistral','neural network',
           'machine learning','transformer','agent','multimodal','diffusion',
           'generative','copilot','nvidia','hugging face']
    return any(kw in t for kw in kws)

def process_source(source_id, sc):
    """Process one source with strict timeout"""
    data = fetch_url(sc['url'])
    if not data:
        return []
    if sc.get('type') == 'atom':
        arts = parse_atom(data)
    else:
        arts = parse_rss(data)
    for a in arts:
        a['source_id'] = source_id
        a['source_name'] = sc['name']
    return arts

def main():
    config = load_config()
    s = config.get('settings', {})
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    seen_path = os.path.join(root, s.get('seen_file', 'scripts/news-monitor/seen.json'))
    max_articles = s.get('max_articles_per_run', 3)
    
    seen = load_seen(seen_path)
    sources = config['sources']
    
    print(f"Scanning {len(sources)} sources...")
    all_new = []
    
    for sid in sources:
        sc = sources[sid]
        name = sc['name']
        sys.stdout.write(f"  [{name}] ")
        sys.stdout.flush()
        
        try:
            with ThreadPoolExecutor(1) as ex:
                arts = ex.submit(process_source, sid, sc).result(timeout=10)
        except:
            arts = []
            sys.stdout.write("TIMEOUT\n")
            sys.stdout.flush()
            continue
        
        new = 0
        for a in arts:
            link = a.get('link','')
            if not link or link in seen:
                continue
            if not is_ai_related(a.get('title',''), a.get('description','')):
                continue
            all_new.append(a)
            new += 1
        
        # Mark as seen NOW to prevent duplicates within same run
        for a in arts:
            if a.get('link') and a['link'] not in seen:
                seen[a['link']] = {
                    'title': a.get('title',''),
                    'source': a.get('source_id',''),
                    'time': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
                }
        
        sys.stdout.write(f"{len(arts)} items, {new} new\n")
        sys.stdout.flush()
    
    save_seen(seen_path, seen)
    
    # Sort by source priority
    all_new.sort(key=lambda a: -sources.get(a.get('source_id',''), {}).get('priority', 5))
    all_new = all_new[:max_articles]
    
    sys.stdout.write(f"\nTotal new AI articles: {len(all_new)}\n")
    sys.stdout.flush()
    print(json.dumps(all_new, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
