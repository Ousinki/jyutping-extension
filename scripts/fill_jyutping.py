#!/usr/bin/env python3
"""
使用 PyCantonese 補充詞典中空白的粵拼數據
"""

import json
import pycantonese

def fill_missing_jyutping():
    print("載入詞典...")
    with open('dictionary.json', 'r', encoding='utf-8') as f:
        dictionary = json.load(f)
    
    total = len(dictionary)
    empty_count = 0
    filled_count = 0
    failed = []
    
    print(f"總詞條數：{total}")
    print("開始補充粵拼...")
    
    for i, (word, entry) in enumerate(dictionary.items()):
        # 跳過已有粵拼的詞條
        if entry.get('jyutping'):
            continue
        
        empty_count += 1
        
        # 使用 PyCantonese 獲取粵拼
        try:
            result = pycantonese.characters_to_jyutping(word)
            if result:
                # result 格式：[('字', 'jyutping'), ...]
                jyutping_parts = []
                for char, jp in result:
                    if jp:
                        jyutping_parts.append(jp)
                
                if jyutping_parts:
                    new_jyutping = ' '.join(jyutping_parts)
                    dictionary[word]['jyutping'] = new_jyutping
                    
                    # 同時生成 Yale 拼音（簡單轉換）
                    # PyCantonese 不直接提供 Yale，暫時留空
                    
                    filled_count += 1
                else:
                    failed.append(word)
            else:
                failed.append(word)
        except Exception as e:
            failed.append(word)
        
        # 每 1000 個詞條顯示進度
        if (i + 1) % 5000 == 0:
            print(f"  進度：{i + 1}/{total} ({(i+1)/total*100:.1f}%)")
    
    print(f"\n完成！")
    print(f"空白粵拼詞條：{empty_count}")
    print(f"成功補充：{filled_count}")
    print(f"仍然缺失：{len(failed)}")
    
    if failed[:20]:
        print(f"\n仍缺失的例子（前 20 個）：")
        for w in failed[:20]:
            print(f"  {w}")
    
    # 保存更新後的詞典
    print("\n保存詞典...")
    with open('dictionary.json', 'w', encoding='utf-8') as f:
        json.dump(dictionary, f, ensure_ascii=False, indent=2)
    
    print("完成！")

if __name__ == '__main__':
    fill_missing_jyutping()
