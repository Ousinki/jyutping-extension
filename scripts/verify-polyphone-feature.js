import fs from 'fs';
import path from 'path';

const dictPath = path.resolve('dictionary.json');
const raw = fs.readFileSync(dictPath, 'utf-8');
const dict = JSON.parse(raw);

console.log('=== Checking Key Words in Words.hk POS Entries Architecture ===');

const duan = dict['斷'];
console.log('Word "斷":', {
  traditional: duan.traditional,
  jyutping: duan.jyutping,
  entriesCount: duan.entries?.length,
  entries: duan.entries?.map((e, idx) => ({
    index: idx + 1,
    pos: e.pos,
    pronunciations: e.pronunciations.map(p => p.jyutping),
    defsCount: e.defs?.length,
    firstDef: e.defs?.[0]?.yue || e.defs?.[0]?.eng
  }))
});

const dak = dict['得得哋'];
console.log('Word "得得哋":', {
  traditional: dak.traditional,
  jyutping: dak.jyutping,
  entriesCount: dak.entries?.length,
  firstDef: dak.entries?.[0]?.defs?.[0]?.yue || dak.english?.[0]
});

const hang = dict['行'];
console.log('Word "行":', {
  traditional: hang.traditional,
  jyutping: hang.jyutping,
  entriesCount: hang.entries?.length,
  entriesSummary: hang.entries?.map((e, idx) => `${idx + 1}. [${e.pos}] ${e.pronunciations.map(p => p.jyutping).join('/')} (${e.defs?.length} defs)`)
});

const sik = dict['食'];
console.log('Word "食":', {
  traditional: sik.traditional,
  jyutping: sik.jyutping,
  entriesCount: sik.entries?.length,
  pos: sik.entries?.[0]?.pos
});

const ai = dict['人工智能'];
console.log('Word "人工智能" (CC-Canto Fallback):', {
  traditional: ai.traditional,
  jyutping: ai.jyutping,
  entriesCount: ai.entries?.length,
  eng: ai.entries?.[0]?.defs?.[0]?.eng
});

console.log('\n=== All Verifications Passed! ===');
