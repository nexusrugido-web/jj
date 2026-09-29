import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const url=process.env.APP_TEST_URL || 'http://127.0.0.1:5173';
const pasta=process.env.APP_SCREENSHOTS || 'artifacts/ofensiva-semanal';
await fs.mkdir(pasta,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  for(const [nome,viewport] of [['android',{width:393,height:852}],['desktop',{width:1440,height:1000}]]) {
    const contexto=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:nome==='android',hasTouch:nome==='android',timezoneId:'America/Sao_Paulo'});
    // Dados sintéticos e nenhuma chamada ao Supabase ou a serviços externos.
    await contexto.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin ? route.continue() : route.abort());
    const page=await contexto.newPage(); const erros=[];
    page.on('pageerror',e=>erros.push(e.message));
    await page.goto(url,{waitUntil:'networkidle'});
    await page.evaluate(async()=>{
      const {db,getMeta,setMeta}=await import('/src/db/db.js');
      const {hojeOfensiva,semanaOfensiva,somarDiasOfensiva}=await import('/src/lib/ofensivaSemanal.js');
      await setMeta('settings',{...(await getMeta('settings',{})),nome:'Praticante de teste',anoNascimento:1995,onboardingFeito:1,tourVisto:1,celebrar:false,metaSemanal:3,aceite:{versao:'2026-09-25.1',em:new Date().toISOString()}});
      const semana=semanaOfensiva(hojeOfensiva());
      for(let i=0;i<8;i++) await db.sessions.add({data:somarDiasOfensiva(semana,-i*7),tipo:'gi',duracao:60,nota:'Treino sintético para validar a interface',criadoEm:Date.now()});
      await db.goals.add({tipo:'frequencia',titulo:'Treinar 3x por semana',alvo:3,status:'ativa',origem:'sugestao',criadoEm:Date.now()});
    });
    await page.reload({waitUntil:'networkidle'});
    await page.locator('.placar-ofa').waitFor();
    await page.waitForFunction(()=>document.querySelector('.placar-ofa')?.textContent.includes('Semana garantida'));
    await page.waitForFunction(()=>document.querySelector('.placar-ofa .placar-num')?.textContent.trim()==='8');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Painel ultrapassa a largura');
    await page.screenshot({path:`${pasta}/${nome}-painel.png`,fullPage:nome==='desktop'});
    await page.locator('.placar-ofa').click();
    await page.getByText('ofensiva semanal',{exact:true}).waitFor();
    await page.screenshot({path:`${pasta}/${nome}-ofensiva.png`,fullPage:false});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Detalhes ultrapassam a largura');
    assert.equal(await page.getByText('2 de 2 escudos',{exact:true}).count(),1);
    assert.deepEqual(erros,[],`Erros de renderização em ${nome}`);
    await contexto.close();
  }
} finally { await browser.close(); }
console.log(`Painel e detalhes verificados em Android emulado e desktop. Capturas: ${pasta}`);
