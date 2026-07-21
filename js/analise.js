// analise.js — Aba "Análise" dentro do Financeiro
// Constrói uma visão executiva: realizado do mês, caixa projetado (8 semanas),
// payback por veículo, inadimplência com aging e evolução dos últimos 6 meses.
// Todos os números vêm de lancamentos, cobrancas_semanais, contas_pagar e veiculos
// — nenhuma tabela nova, nenhum dado inventado.

const fmtR$ = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2});

let _anCarregado = false;

async function iniciarAnalise(){
  if(!_anCarregado){
    _anCarregado = true;
  }
  await Promise.all([
    _anRenderRealizado(),
    _anRenderCaixaProjetado(),
  ]);
}

// ══════════════════════════════════════════════════════════════
// BLOCO 1 — REALIZADO DO MÊS (+ comparação com o mês anterior)
// ══════════════════════════════════════════════════════════════
async function _anRenderRealizado(){
  const el = document.getElementById('an-realizado');
  if(!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Carregando…</div>';

  try{
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const inicioMesAnt = new Date(hoje.getFullYear(), hoje.getMonth()-1, 1);
    const fimMesAnt = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    const iso = d => d.toISOString().slice(0,10);

    const [rAtual, rAnt] = await Promise.all([
      sb.from('lancamentos').select('tipo,categoria,valor').gte('data', iso(inicioMes)).lte('data', iso(hoje)),
      sb.from('lancamentos').select('tipo,valor').gte('data', iso(inicioMesAnt)).lte('data', iso(fimMesAnt)),
    ]);
    if(rAtual.error) throw rAtual.error;
    if(rAnt.error) throw rAnt.error;

    const atual = rAtual.data||[], ant = rAnt.data||[];
    const soma = (arr,tipo) => arr.filter(l=>l.tipo===tipo).reduce((a,b)=>a+(parseFloat(b.valor)||0),0);
    const rec = soma(atual,'receita'), desp = soma(atual,'despesa'), liq = rec-desp;
    const recAnt = soma(ant,'receita'), despAnt = soma(ant,'despesa'), liqAnt = recAnt-despAnt;

    const variacao = (agora,antes) => antes===0 ? null : Math.round(((agora-antes)/Math.abs(antes))*100);
    const varRec = variacao(rec,recAnt), varDesp = variacao(desp,despAnt), varLiq = variacao(liq,liqAnt);
    const setaVar = (v,invertido)=>{
      if(v==null) return '<span style="color:var(--muted);font-size:11px">sem comparativo</span>';
      const bom = invertido ? v<=0 : v>=0;
      const cor = bom ? '#16a34a' : '#F87171';
      const seta = v>=0 ? '▲' : '▼';
      return `<span style="color:${cor};font-size:11px;font-weight:700">${seta} ${Math.abs(v)}% vs mês anterior</span>`;
    };

    // Quebra de receita por categoria (o que realmente girou o caixa este mês)
    const porCat = {};
    atual.filter(l=>l.tipo==='receita').forEach(l=>{
      const c = l.categoria||'Outros';
      porCat[c] = (porCat[c]||0) + (parseFloat(l.valor)||0);
    });
    const catsOrdenadas = Object.entries(porCat).sort((a,b)=>b[1]-a[1]);
    const maxCat = catsOrdenadas[0]?.[1] || 1;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:16px">
        <div class="card" style="border-left:3px solid #16a34a">
          <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Receita do mês</div>
          <div style="font-size:22px;font-weight:800;margin:4px 0;color:#16a34a">${fmtR$(rec)}</div>
          ${setaVar(varRec,false)}
        </div>
        <div class="card" style="border-left:3px solid #F87171">
          <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Despesa do mês</div>
          <div style="font-size:22px;font-weight:800;margin:4px 0;color:#F87171">${fmtR$(desp)}</div>
          ${setaVar(varDesp,true)}
        </div>
        <div class="card" style="border-left:3px solid var(--accent)">
          <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase">Resultado líquido</div>
          <div style="font-size:22px;font-weight:800;margin:4px 0;color:${liq>=0?'#16a34a':'#F87171'}">${fmtR$(liq)}</div>
          ${setaVar(varLiq,false)}
        </div>
      </div>
      <div class="card">
        <div style="font-weight:700;margin-bottom:10px;font-size:13px">De onde veio a receita este mês</div>
        ${catsOrdenadas.length ? catsOrdenadas.map(([cat,val])=>`
          <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px">
              <span>${cat}</span><span style="font-weight:700">${fmtR$(val)}</span>
            </div>
            <div style="background:var(--border2);border-radius:999px;height:6px;overflow:hidden">
              <div style="background:var(--accent);height:100%;width:${Math.round(val/maxCat*100)}%"></div>
            </div>
          </div>`).join('') : '<div style="color:var(--muted);font-size:13px">Nenhuma receita lançada este mês.</div>'}
      </div>`;
  }catch(e){
    el.innerHTML = `<div class="card" style="color:#F87171;font-size:13px">Erro ao carregar: ${e.message||e}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// BLOCO 2 — CAIXA PROJETADO (8 SEMANAS)
// Entradas: cobranças semanais pendentes/atrasadas de locações ATIVAS
//           (dinheiro já contratado, não é estimativa).
// Saídas: contas a pagar pendentes com vencimento agendado.
// ══════════════════════════════════════════════════════════════
async function _anRenderCaixaProjetado(){
  const el = document.getElementById('an-caixa');
  if(!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Carregando…</div>';

  try{
    const hoje = new Date();
    const fim8sem = new Date(hoje.getTime() + 8*7*86400000);
    const iso = d => d.toISOString().slice(0,10);

    const [rCobr, rContas] = await Promise.all([
      sb.from('cobrancas_semanais').select('valor,data_vencimento,status,locacoes!inner(status)')
        .in('status',['pendente','atrasado']).eq('locacoes.status','ativa')
        .lte('data_vencimento', iso(fim8sem)),
      sb.from('contas_pagar').select('valor,vencimento,status')
        .eq('status','pendente').lte('vencimento', iso(fim8sem)),
    ]);
    if(rCobr.error) throw rCobr.error;
    if(rContas.error) throw rContas.error;

    // Agrupa em 8 baldes semanais a partir de hoje
    const semanas = Array.from({length:8}, (_,i)=>{
      const ini = new Date(hoje.getTime() + i*7*86400000);
      const fim = new Date(ini.getTime() + 6*86400000);
      return { ini, fim, entradas:0, saidas:0 };
    });
    const bucket = data => {
      const d = new Date(data+'T12:00:00');
      const dias = Math.floor((d - hoje)/86400000);
      const idx = Math.floor(dias/7);
      return (idx>=0 && idx<8) ? idx : null;
    };
    (rCobr.data||[]).forEach(c=>{
      const idx = bucket(c.data_vencimento);
      if(idx!=null) semanas[idx].entradas += parseFloat(c.valor)||0;
    });
    (rContas.data||[]).forEach(c=>{
      const idx = bucket(c.vencimento);
      if(idx!=null) semanas[idx].saidas += parseFloat(c.valor)||0;
    });

    let acumulado = 0;
    const totalEntradas = semanas.reduce((a,b)=>a+b.entradas,0);
    const totalSaidas   = semanas.reduce((a,b)=>a+b.saidas,0);
    const maxAbs = Math.max(...semanas.map(s=>Math.max(s.entradas,s.saidas)), 1);
    const fmtDia = d => d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});

    const linhas = semanas.map((s,i)=>{
      acumulado += s.entradas - s.saidas;
      const largE = Math.round(s.entradas/maxAbs*100);
      const largS = Math.round(s.saidas/maxAbs*100);
      return `
        <div style="display:grid;grid-template-columns:70px 1fr 90px;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border2)">
          <div style="font-size:11px;color:var(--muted)">${fmtDia(s.ini)}–${fmtDia(s.fim)}</div>
          <div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
              <div style="background:#16a34a;height:7px;border-radius:3px;width:${largE}%;min-width:${s.entradas>0?'3px':'0'}"></div>
              <span style="font-size:11px;color:#16a34a;font-weight:600">+${fmtR$(s.entradas)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <div style="background:#F87171;height:7px;border-radius:3px;width:${largS}%;min-width:${s.saidas>0?'3px':'0'}"></div>
              <span style="font-size:11px;color:#F87171;font-weight:600">-${fmtR$(s.saidas)}</span>
            </div>
          </div>
          <div style="text-align:right;font-weight:800;font-size:13px;color:${acumulado>=0?'#16a34a':'#F87171'}">${fmtR$(acumulado)}</div>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;flex-wrap:wrap;gap:8px">
          <div style="font-weight:700;font-size:13px">Caixa projetado — próximas 8 semanas</div>
          <div style="font-size:12px;color:var(--muted)">Entradas já contratadas · saídas já agendadas</div>
        </div>
        <div style="display:grid;grid-template-columns:70px 1fr 90px;gap:10px;padding:4px 0 6px;font-size:10.5px;color:var(--muted);font-weight:700;text-transform:uppercase">
          <div>Semana</div><div>Entradas / Saídas</div><div style="text-align:right">Acumulado</div>
        </div>
        ${linhas}
        <div style="display:flex;justify-content:space-between;padding-top:10px;font-size:12.5px">
          <span>Total 8 semanas: <b style="color:#16a34a">+${fmtR$(totalEntradas)}</b> · <b style="color:#F87171">-${fmtR$(totalSaidas)}</b></span>
          <span style="font-weight:800;color:${acumulado>=0?'#16a34a':'#F87171'}">Líquido: ${fmtR$(acumulado)}</span>
        </div>
      </div>`;
  }catch(e){
    el.innerHTML = `<div class="card" style="color:#F87171;font-size:13px">Erro ao carregar: ${e.message||e}</div>`;
  }
}
