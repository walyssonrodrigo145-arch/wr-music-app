const fs = require('fs');
let code = fs.readFileSync('server/automationJob.ts', 'utf-8');

// 1. Limpar a duplicação do bloco de Aula Experimental.
// Vamos procurar a string '4.1 LEMBRETE DE AULA EXPERIMENTAL' e se houver mais de uma, deletamos a segunda!
const parts = code.split('// ─── 4.1 LEMBRETE DE AULA EXPERIMENTAL (24h e 1h) ─────────────────────────');
if (parts.length === 3) { // It means it was duplicated!
  // part 0 is everything before
  // part 1 is the first block
  // part 2 is the second block
  // But wait, the second block goes all the way to the end!
  // We should extract what is after the block in part 1 or part 2.
  // We can just keep part 0 + part 1 + what comes AFTER part 2's end.
  // Actually, part 1 contains the code of the block and then it ends right before part 2 starts.
  // The code at the end of part 1: `      }\n      \n      `
  // We can just remove part 1 entirely and keep part 0 and part 2, which has the rest of the file!
  code = parts[0] + '// ─── 4.1 LEMBRETE DE AULA EXPERIMENTAL (24h e 1h) ─────────────────────────' + parts[2];
}

// Write the fixed code back so we can see it clearly
fs.writeFileSync('server/automationJob.ts', code);
console.log('Duplication fixed.');
