#!/usr/bin/env python3
"""
同步繁簡體詞條的粵拼：
如果簡體詞的粵拼不完整，從對應的繁體詞複製
"""

import json

def sync_jyutping():
    print("載入詞典...")
    with open('dictionary.json', 'r', encoding='utf-8') as f:
        dictionary = json.load(f)
    
    fixed_count = 0
    
    print("開始同步繁簡體粵拼...")
    
    for word, entry in dictionary.items():
        traditional = entry.get('traditional', '')
        simplified = entry.get('simplified', '')
        jyutping = entry.get('jyutping', '')
        
        # 如果當前詞是簡體，且粵拼不完整
        if word == simplified and traditional != simplified:
            # 檢查繁體詞條是否存在且有完整粵拼
            if traditional in dictionary:
                trad_entry = dictionary[traditional]
                trad_jyutping = trad_entry.get('jyutping', '')
                
                # 如果繁體粵拼更完整（空格分隔的音節更多）
                if trad_jyutping and len(trad_jyutping.split()) > len(jyutping.split()):
                    dictionary[word]['jyutping'] = trad_jyutping
                    if trad_entry.get('yale'):
                        dictionary[word]['yale'] = trad_entry['yale']
                    fixed_count += 1
                    
                    if fixed_count <= 10:
                        print(f"  修復: {word} ({jyutping}) → {trad_jyutping}")
    
    print(f"\n共修復 {fixed_count} 個簡體詞條")
    
    # 保存
    print("保存詞典...")
    with open('dictionary.json', 'w', encoding='utf-8') as f:
        json.dump(dictionary, f, ensure_ascii=False, indent=2)
    
    print("完成！")

if __name__ == '__main__':
    sync_jyutping()
