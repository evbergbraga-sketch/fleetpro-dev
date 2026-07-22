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
    _anRenderVeiculos(),
    _anRenderInadimplencia(),
    _anRenderEvolucao(),
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

// ══════════════════════════════════════════════════════════════
// BLOCO 3 — DESEMPENHO POR VEÍCULO
// Payback: receita total (lancamentos) ÷ valor de compra, desde sempre.
// Ocupação: % de dias em locação nos últimos 90 dias (janela fixa —
// comparável entre veículos de idades diferentes).
// Receita/dia: receita total ÷ dias corridos desde a compra.
// ══════════════════════════════════════════════════════════════
let _anVeiculosDados = [];
let _anVeiculosExpandido = false;

async function _anRenderVeiculos(){
  const el = document.getElementById('an-veiculos');
  if(!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Carregando…</div>';

  try{
    const hoje = new Date();
    const janela90 = new Date(hoje.getTime() - 90*86400000);

    const [rVeic, rRec, rLoc] = await Promise.all([
      sb.from('veiculos').select('id,marca,modelo,placa,tipo,status,foto_url,valor_compra,data_compra').neq('status','vendido'),
      sb.from('lancamentos').select('veiculo_id,valor').eq('tipo','receita').not('veiculo_id','is',null),
      sb.from('locacoes').select('veiculo_id,data_inicio,data_fim,status'),
    ]);
    if(rVeic.error) throw rVeic.error;
    if(rRec.error) throw rRec.error;
    if(rLoc.error) throw rLoc.error;

    const veiculos = rVeic.data||[], receitas = rRec.data||[], locacoes = rLoc.data||[];

    _anVeiculosDados = veiculos.map(v=>{
      const receitaTotal = receitas.filter(r=>r.veiculo_id===v.id).reduce((a,r)=>a+(parseFloat(r.valor)||0),0);
      let custo = parseFloat(v.valor_compra)||0;
      // Valores abaixo de R$1.000 para um veículo são quase certamente erro
      // de cadastro (ex: faltou dígito) — tratamos como "não informado" em
      // vez de calcular um payback absurdo (ex: 5000%)
      const custoSuspeito = custo>0 && custo<1000;
      if(custoSuspeito) custo = 0;
      const pctRecuperado = custo>0 ? Math.round(receitaTotal/custo*100) : null;

      // Ocupação nos últimos 90 dias: soma a sobreposição de cada locação
      // desse veículo com a janela [janela90, hoje]
      const locsVeic = locacoes.filter(l=>l.veiculo_id===v.id);
      let diasOcupado = 0;
      locsVeic.forEach(l=>{
        if(!l.data_inicio) return;
        const ini = new Date(Math.max(new Date(l.data_inicio), janela90));
        const fim = new Date(Math.min(l.data_fim?new Date(l.data_fim):hoje, hoje));
        if(fim>ini) diasOcupado += Math.round((fim-ini)/86400000);
      });
      const pctOcupacao = Math.min(100, Math.round(diasOcupado/90*100));

      const diasDesdeCompra = v.data_compra ? Math.max(1, Math.round((hoje-new Date(v.data_compra))/86400000)) : null;
      const receitaDia = diasDesdeCompra ? receitaTotal/diasDesdeCompra : null;

      return { v, receitaTotal, custo, custoSuspeito, pctRecuperado, pctOcupacao, receitaDia };
    }).sort((a,b)=>{
      // Sem valor de compra cadastrado vai pro fim; senão, pior payback primeiro
      if(a.pctRecuperado==null && b.pctRecuperado==null) return 0;
      if(a.pctRecuperado==null) return 1;
      if(b.pctRecuperado==null) return -1;
      return a.pctRecuperado - b.pctRecuperado;
    });

    _anVeiculosExpandido = false;

    // Shell fixo: renderizado UMA vez. O campo de busca e a lista ficam
    // dentro de um container próprio (#an-veic-lista) que é o único
    // atualizado a cada tecla digitada — assim o input nunca perde o foco
    // (re-renderizar o input inteiro a cada tecla fazia só dar pra digitar
    // uma letra por vez).
    el.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;flex-wrap:wrap;gap:8px">
          <div style="font-weight:700;font-size:13px">Desempenho por veículo</div>
          <input type="text" id="an-veic-busca" placeholder="Buscar por modelo ou placa..." oninput="_anRenderVeiculosLista()" style="font-size:12px;padding:5px 10px;max-width:220px">
        </div>
        <div id="an-veic-sub" style="font-size:11px;color:var(--muted);margin-bottom:10px"></div>
        <div id="an-veic-lista"></div>
      </div>`;

    _anRenderVeiculosLista();
  }catch(e){
    el.innerHTML = `<div class="card" style="color:#F87171;font-size:13px">Erro ao carregar: ${e.message||e}</div>`;
  }
}

function _anToggleVeiculosExpandido(){
  _anVeiculosExpandido = !_anVeiculosExpandido;
  _anRenderVeiculosLista();
}

function _anRenderVeiculosLista(){
  const listaEl = document.getElementById('an-veic-lista');
  const subEl   = document.getElementById('an-veic-sub');
  if(!listaEl) return;
  const busca = (document.getElementById('an-veic-busca')?.value||'').toLowerCase().trim();

  const linha = (label,val,cor) => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:2px 0"><span style="color:var(--muted)">${label}</span><span style="font-weight:700;${cor?`color:${cor}`:''}">${val}</span></div>`;

  const filtrados = _anVeiculosDados.filter(d=>{
    if(!busca) return true;
    const alvo = `${d.v.marca} ${d.v.modelo} ${d.v.placa}`.toLowerCase();
    return alvo.includes(busca);
  });
  const limite = _anVeiculosExpandido ? filtrados.length : 7;
  const visiveis = filtrados.slice(0, limite);
  const restante = filtrados.length - limite;

  if(subEl) subEl.textContent = `Payback (receita histórica ÷ custo de compra) · Ocupação nos últimos 90 dias · ${filtrados.length} veículo${filtrados.length===1?'':'s'}`;

  if(!filtrados.length){
    listaEl.innerHTML = '<div style="font-size:13px;color:var(--muted)">Nenhum veículo encontrado.</div>';
    return;
  }

  const cardsHtml = visiveis.map(d=>{
    const vTipo = d.v.tipo||'carro';
    const thumb = d.v.foto_url
      ? `<div class="vi vi-foto" style="margin-bottom:6px"><img src="${d.v.foto_url}" onerror="this.parentElement.className='vi ${vTipo==='carro'?'vi-car':'vi-moto'}';this.parentElement.innerHTML=SVG_VEICULO('${vTipo}')"></div>`
      : `<div class="vi ${vTipo==='carro'?'vi-car':'vi-moto'}" style="margin-bottom:6px">${SVG_VEICULO(vTipo)}</div>`;
    return `
            <div style="border:1px solid var(--border2);border-radius:10px;padding:10px 12px">
              ${thumb}
              <div style="font-weight:700;font-size:13px">${d.v.marca} ${d.v.modelo}</div>
              <div style="font-size:11px;color:var(--muted);margin-bottom:6px">${d.v.placa}</div>
              ${d.custo>0 ? `
                ${linha('Custo de compra', fmtR$(d.custo))}
                ${linha('Recebido (histórico)', fmtR$(d.receitaTotal), '#16a34a')}
                <div style="background:var(--border2);border-radius:999px;height:5px;overflow:hidden;margin:5px 0">
                  <div style="background:${d.pctRecuperado>=100?'#16a34a':'var(--accent)'};height:100%;width:${Math.min(100,d.pctRecuperado)}%"></div>
                </div>
                ${linha('Payback', d.pctRecuperado+'%', d.pctRecuperado>=100?'#16a34a':null)}
              ` : `<div style="font-size:11px;color:${d.custoSuspeito?'#F5B942':'var(--muted)'};font-style:italic;margin-bottom:6px">${d.custoSuspeito?'Valor de compra parece incorreto (R$ '+d.v.valor_compra+') — confira o cadastro':'Sem valor de compra cadastrado'}</div>`}
              ${linha('Ocupação (90d)', d.pctOcupacao+'%', d.pctOcupacao>=70?'#16a34a':d.pctOcupacao<30?'#F87171':null)}
              ${d.receitaDia!=null?linha('Receita/dia (média)', fmtR$(d.receitaDia)):''}
            </div>`;
  }).join('');

  listaEl.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px">
          ${cardsHtml}
        </div>
        ${filtrados.length>7 ? `
        <div style="text-align:center;padding-top:12px">
          <button class="btn btn-ghost" onclick="_anToggleVeiculosExpandido()" style="font-size:12px;padding:5px 16px">
            ${_anVeiculosExpandido ? 'Exibir menos' : `Exibir mais (${restante})`}
          </button>
        </div>` : ''}`;
}

// ══════════════════════════════════════════════════════════════
// BLOCO 4 — INADIMPLÊNCIA COM AGING
// Cobranças semanais vencidas (pendente/atrasado + data_vencimento no
// passado), agrupadas por faixa de atraso — prioriza quem cobrar primeiro.
// ══════════════════════════════════════════════════════════════
async function _anRenderInadimplencia(){
  const el = document.getElementById('an-inadimplencia');
  if(!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Carregando…</div>';

  try{
    const hoje = new Date();
    const {data, error} = await sb.from('cobrancas_semanais')
      .select('valor,data_vencimento,status,locacoes(clientes(nome))')
      .in('status',['pendente','atrasado'])
      .lt('data_vencimento', hoje.toISOString().slice(0,10));
    if(error) throw error;

    const vencidas = (data||[]).map(c=>({
      ...c,
      diasAtraso: Math.floor((hoje - new Date(c.data_vencimento+'T12:00:00'))/86400000)
    }));

    const faixas = [
      {label:'1–7 dias',   min:1,  max:7},
      {label:'8–14 dias',  min:8,  max:14},
      {label:'15–30 dias', min:15, max:30},
      {label:'30+ dias',   min:31, max:Infinity},
    ];
    const buckets = faixas.map(f=>{
      const itens = vencidas.filter(c=>c.diasAtraso>=f.min && c.diasAtraso<=f.max);
      return { ...f, count:itens.length, valor:itens.reduce((a,c)=>a+(parseFloat(c.valor)||0),0) };
    });
    const totalValor = vencidas.reduce((a,c)=>a+(parseFloat(c.valor)||0),0);
    const maxValor = Math.max(...buckets.map(b=>b.valor), 1);
    const cores = ['#F5B942','#F59E0B','#F87171','#B91C1C'];

    el.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;flex-wrap:wrap;gap:6px">
          <div style="font-weight:700;font-size:13px">Inadimplência por tempo de atraso</div>
          <div style="font-size:12px;color:var(--muted)">Total vencido: <b style="color:#F87171">${fmtR$(totalValor)}</b> em ${vencidas.length} semana${vencidas.length===1?'':'s'}</div>
        </div>
        ${vencidas.length===0 ? '<div style="font-size:13px;color:#16a34a">Nenhuma cobrança vencida no momento.</div>' :
          buckets.map((b,i)=>`
            <div style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
                <span>${b.label} <span style="color:var(--muted)">(${b.count})</span></span>
                <span style="font-weight:700">${fmtR$(b.valor)}</span>
              </div>
              <div style="background:var(--border2);border-radius:999px;height:7px;overflow:hidden">
                <div style="background:${cores[i]};height:100%;width:${Math.round(b.valor/maxValor*100)}%;min-width:${b.valor>0?'3px':'0'}"></div>
              </div>
            </div>`).join('')}
      </div>`;
  }catch(e){
    el.innerHTML = `<div class="card" style="color:#F87171;font-size:13px">Erro ao carregar: ${e.message||e}</div>`;
  }
}

// ══════════════════════════════════════════════════════════════
// BLOCO 5 — EVOLUÇÃO (últimos 6 meses)
// Receita x despesa mês a mês, para enxergar tendência/sazonalidade.
// ══════════════════════════════════════════════════════════════
async function _anRenderEvolucao(){
  const el = document.getElementById('an-evolucao');
  if(!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px">Carregando…</div>';

  try{
    const hoje = new Date();
    const inicio6m = new Date(hoje.getFullYear(), hoje.getMonth()-5, 1);
    const {data, error} = await sb.from('lancamentos').select('tipo,valor,data')
      .gte('data', inicio6m.toISOString().slice(0,10));
    if(error) throw error;
    const lanc = data||[];

    const meses = Array.from({length:6}, (_,i)=>{
      const d = new Date(hoje.getFullYear(), hoje.getMonth()-5+i, 1);
      return { label: d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}), ym: d.toISOString().slice(0,7), receita:0, despesa:0 };
    });
    lanc.forEach(l=>{
      const ym = (l.data||'').slice(0,7);
      const m = meses.find(x=>x.ym===ym);
      if(!m) return;
      if(l.tipo==='receita') m.receita += parseFloat(l.valor)||0;
      else if(l.tipo==='despesa') m.despesa += parseFloat(l.valor)||0;
    });
    const maxVal = Math.max(...meses.map(m=>Math.max(m.receita,m.despesa)), 1);

    el.innerHTML = `
      <div class="card">
        <div style="font-weight:700;margin-bottom:12px;font-size:13px">Evolução — últimos 6 meses</div>
        <div style="display:flex;align-items:flex-end;gap:10px;height:160px;padding:0 4px">
          ${meses.map(m=>`
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end">
              <div style="display:flex;align-items:flex-end;gap:3px;height:130px">
                <div title="Receita: ${fmtR$(m.receita)}" style="width:14px;background:#16a34a;border-radius:3px 3px 0 0;height:${Math.max(2,Math.round(m.receita/maxVal*130))}px"></div>
                <div title="Despesa: ${fmtR$(m.despesa)}" style="width:14px;background:#F87171;border-radius:3px 3px 0 0;height:${Math.max(2,Math.round(m.despesa/maxVal*130))}px"></div>
              </div>
              <div style="font-size:10px;color:var(--muted);text-transform:capitalize">${m.label}</div>
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:14px;margin-top:10px;font-size:11px;color:var(--muted)">
          <span><span style="display:inline-block;width:9px;height:9px;background:#16a34a;border-radius:2px;margin-right:4px"></span>Receita</span>
          <span><span style="display:inline-block;width:9px;height:9px;background:#F87171;border-radius:2px;margin-right:4px"></span>Despesa</span>
        </div>
      </div>`;
  }catch(e){
    el.innerHTML = `<div class="card" style="color:#F87171;font-size:13px">Erro ao carregar: ${e.message||e}</div>`;
  }
}
