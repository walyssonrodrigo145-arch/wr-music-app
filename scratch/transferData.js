import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

// =========================================================================
// 1. COLOQUE AQUI A URL DO BANCO ESTÁ COM SEUS DADOS SALVOS (RENDER)
// =========================================================================
const OLD_DATABASE_URL = "postgresql://wruser:O3IVDF00UPZ2C4rJE0clpyAEpO0cpu9w@dpg-d75e0rcr85hc73888q80-a.oregon-postgres.render.com/wrmusic";


// A URL nova já está puxando do arquivo .env automaticamente (AIVEN)
const NEW_DATABASE_URL = process.env.DATABASE_URL;

async function migrate() {
  if (OLD_DATABASE_URL === "COLE-SUA-URL-DO-RENDER-AQUI") {
    console.error("❌ ERRO: Você esqueceu de colocar a URL do banco antigo no script!");
    process.exit(1);
  }

  console.log("Conectando aos bancos de dados...");
  
  // prepare: false é seguro para não dar erro entre versões diferentes
  const sqlOld = postgres(OLD_DATABASE_URL, { prepare: false, ssl: { rejectUnauthorized: false }  });
  const sqlNew = postgres(NEW_DATABASE_URL, { prepare: false, ssl: { rejectUnauthorized: false }  });

  // A ORDEM AQUI IMPORTA (Usuarios primeiro, depois dependentes)
  const tables = [
    'users', 
    'settings', 
    'instruments', 
    'students', 
    'lessons', 
    'payment_dues', 
    'monthly_stats', 
    'reminder_templates', 
    'reminders'
  ];

  try {
    console.log("\n🧹 Limpando o banco de dados novo para evitar dados duplicados...");
    // Limpa todas as tabelas no Aiven antes de injetar os reais
    for (const table of [...tables].reverse()) {
      await sqlNew`TRUNCATE TABLE ${sqlNew(table)} RESTART IDENTITY CASCADE`;
    }

    for (const table of tables) {
      console.log(`\n⏳ Copiando tabela: ${table}`);
      
      const rows = await sqlOld`select * from ${sqlOld(table)} order by id asc`;
      
      if (rows.length > 0) {
        // Tenta preencher no banco novo
        await sqlNew`insert into ${sqlNew(table)} ${sqlNew(rows)}`;
        console.log(`  ✅ ${rows.length} registros inseridos.`);
        
        // Sincroniza a numeração automática de IDs (Sequence) para as novas inserções depois não darem erro
        await sqlNew`SELECT setval(pg_get_serial_sequence(${table}, 'id'), coalesce(max(id),0) + 1, false) FROM ${sqlNew(table)}`;
        console.log(`  ⚙️ Sequence ajustada.`);
      } else {
        console.log(`  ⚪ Tabela vazia. Ignorando.`);
      }
    }
    
    console.log("\n🎉 MIGRAÇÃO DE DADOS FINALIZADA COM SUCESSO!");

  } catch (error) {
    console.error("\n❌ ERRO durante a cópia dos dados:", error);
  } finally {
    // Encerrar conexões
    await sqlOld.end();
    await sqlNew.end();
  }
}

migrate();
