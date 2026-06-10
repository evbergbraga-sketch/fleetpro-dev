// locacoes.js — Aba de Locações em andamento + Checklist de vistoria

// allLocacoesCompletas declarado em config.js
let _checklistItens = [];      // itens padrão do checklist

// ══ RENDER LISTA DE LOCAÇÕES ══
function renderLocacoes(){
  const tb = document.getElementById('tb-locacoes');
  if(!tb) return;
  const ativas = allLocacoesCompletas.filter(l=>l.status==='ativa');
  if(!ativas.length){
    tb.innerHTML='<tr class="empty-row"><td colspan="6">Nenhuma locação ativa no momento</td></tr>';
    return;
  }
  tb.innerHTML = ativas.map(l=>{
    const diff = Math.ceil((new Date(l.data_fim)-new Date())/86400000);
    const badge = diff<0
      ? '<span class="badge badge-red">Atrasado</span>'
      : diff===0
        ? '<span class="badge badge-yellow">Vence hoje</span>'
        : `<span class="badge badge-green">+${diff}d</span>`;
    const icone = l.veiculos?.tipo==='moto'?'🏍️':'🚗';
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="vi ${l.veiculos?.tipo==='carro'?'vi-car':'vi-moto'}">${icone}</div>
          <div>
            <div style="font-weight:500">${l.veiculos?.marca||''} ${l.veiculos?.modelo||''}</div>
            <div style="font-size:11px;color:var(--muted)">${l.veiculos?.placa||''}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight:500">${l.clientes?.nome||'—'}</div>
        <div style="font-size:11px;color:var(--muted)">${l.clientes?.telefone||''}</div>
      </td>
      <td>${fmtData(l.data_inicio)}</td>
      <td>${fmtData(l.data_fim)}</td>
      <td>${badge}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-primary" style="font-size:11px;padding:5px 12px" onclick="abrirModalLocacao('${l.id}')">📋 Detalhes</button>
          <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="abrirModalLocacaoEntrada('${l.id}')">✅ Devolver</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ══ LOAD LOCAÇÕES COMPLETAS ══
async function loadLocacoesCompletas(){
  const {data, error} = await sb.from('locacoes')
    .select(`
      id, veiculo_id, cliente_id, data_inicio, data_fim,
      km_inicial, km_final, diaria, total, status, observacoes,
      criado_por, created_at,
      num_contrato, tipo_contrato, local_retirada, caucao,
      forma_pgto, servicos_adicionais,
      data_inicio_hora, data_fim_hora,
      veiculos(id, marca, modelo, placa, tipo, km_atual),
      clientes(id, nome, cpf, telefone, email)
    `)
    .eq('status','ativa')
    .order('data_fim',{ascending:true});
  if(error){
    // Fallback sem campos novos caso SQL não tenha rodado ainda
    const {data:data2} = await sb.from('locacoes')
      .select('*,veiculos(id,marca,modelo,placa,tipo,km_atual),clientes(id,nome,cpf,telefone,email)')
      .eq('status','ativa')
      .order('data_fim',{ascending:true});
    allLocacoesCompletas = data2||[];
    allLocacoes = data2||[];
    return;
  }
  allLocacoesCompletas = data||[];
  allLocacoes = data||[];
}

// ══ MODAL DETALHES DA LOCAÇÃO ══
async function abrirModalLocacao(locId){
  const modal = document.getElementById('m-locacao-detalhe');
  const body  = document.getElementById('locacao-detalhe-body');
  if(!modal||!body) return;

  body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">⏳ Carregando...</div>`;
  modal.classList.add('show');

  // Busca locação completa
  const {data:loc} = await sb.from('locacoes')
    .select('*,veiculos(*),clientes(*)')
    .eq('id',locId).single();
  if(!loc){ body.innerHTML='<p style="color:var(--red)">Locação não encontrada.</p>'; return; }

  // Busca checklists existentes (tabela pode não existir ainda)
  let checks = [];
  try {
    const {data:checksData, error:chkErr} = await sb.from('checklists')
      .select('*')
      .eq('locacao_id',locId)
      .order('created_at',{ascending:true});
    if(!chkErr) checks = checksData||[];
  } catch(e){ checks = []; }

  const checkSaida   = checks.find(c=>c.tipo==='saida');
  const checkEntrada = checks.find(c=>c.tipo==='entrada');

  const diff = Math.ceil((new Date(loc.data_fim)-new Date())/86400000);
  const statusColor = diff<0?'#dc2626':diff===0?'#d97706':'#16a34a';
  const statusLabel = diff<0?`Atrasado ${Math.abs(diff)}d`:diff===0?'Vence hoje':`${diff} dias restantes`;

  body.innerHTML = `
    <!-- HEADER DA LOCAÇÃO -->
    <div style="background:linear-gradient(135deg,#1d4ed8,#2563EB);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:1px">Contrato #${loc.num_contrato||'—'}</div>
          <div style="font-size:20px;font-weight:800;margin:4px 0">${loc.veiculos?.marca||''} ${loc.veiculos?.modelo||''}</div>
          <div style="font-size:13px;opacity:.85">Placa: ${loc.veiculos?.placa||'—'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;opacity:.7">Status</div>
          <div style="font-size:14px;font-weight:700;color:${statusColor==='#16a34a'?'#a7f3d0':statusColor==='#d97706'?'#fde68a':'#fca5a5'}">${statusLabel}</div>
        </div>
      </div>
    </div>

    <!-- DADOS PRINCIPAIS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="background:var(--bg2);border-radius:10px;padding:14px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:8px">👤 Cliente</div>
        <div style="font-weight:600;font-size:14px">${loc.clientes?.nome||'—'}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">CPF: ${loc.clientes?.cpf||'—'}</div>
        <div style="font-size:12px;color:var(--muted)">Tel: ${loc.clientes?.telefone||'—'}</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:14px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:8px">📅 Período</div>
        <div style="font-size:12px"><strong>Retirada:</strong> ${loc.data_inicio_hora ? _fmtDtLocacao(loc.data_inicio_hora) : fmtData(loc.data_inicio)}</div>
        <div style="font-size:12px"><strong>Devolução:</strong> ${loc.data_fim_hora ? _fmtDtLocacao(loc.data_fim_hora) : fmtData(loc.data_fim)}</div>
        <div style="font-size:12px"><strong>Local:</strong> ${loc.local_retirada||'Loja'}</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:14px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:8px">💰 Financeiro</div>
        <div style="font-size:12px"><strong>Diária:</strong> R$ ${(loc.diaria||0).toFixed(2).replace('.',',')}</div>
        <div style="font-size:12px"><strong>Total:</strong> <span style="color:var(--accent);font-weight:700">R$ ${(loc.total||0).toFixed(2).replace('.',',')}</span></div>
        <div style="font-size:12px"><strong>Pagamento:</strong> ${loc.forma_pgto||'—'}</div>
        ${loc.caucao>0?`<div style="font-size:12px"><strong>Caução:</strong> R$ ${(loc.caucao||0).toFixed(2).replace('.',',')}</div>`:''}
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:14px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:8px">🚗 Veículo</div>
        <div style="font-size:12px"><strong>Km saída:</strong> ${loc.km_inicial||'—'}</div>
        <div style="font-size:12px"><strong>Tipo:</strong> ${loc.tipo_contrato==='moto'?'🏍️ Moto':'🚗 Carro'}</div>
        ${loc.servicos_adicionais?.length>0?`<div style="font-size:12px"><strong>Serviços:</strong> ${loc.servicos_adicionais.map(s=>s.descricao).join(', ')}</div>`:''}
      </div>
    </div>

    ${loc.observacoes?`
    <div style="background:var(--bg2);border-radius:10px;padding:14px;margin-bottom:20px">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted2);margin-bottom:6px">📝 Observações</div>
      <div style="font-size:13px;color:var(--text)">${loc.observacoes}</div>
    </div>`:''}

    <!-- ABAS CHECKLISTS -->
    <div style="border-bottom:2px solid var(--border2);margin-bottom:16px;display:flex;gap:0">
      <button id="tab-saida" class="loc-tab active" onclick="showLocTab('saida')"
        style="padding:8px 20px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;border-bottom:2px solid var(--accent);color:var(--accent);margin-bottom:-2px">
        🚗 Saída ${checkSaida?'✓':''}
      </button>
      <button id="tab-entrada" class="loc-tab" onclick="showLocTab('entrada')"
        style="padding:8px 20px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-2px">
        🏁 Entrada ${checkEntrada?'✓':''}
      </button>
    </div>

    <!-- PAINEL SAÍDA -->
    <div id="painel-saida">
      ${checkSaida ? _renderChecklistExistente(checkSaida) : _renderFormChecklist('saida', locId, loc)}
    </div>

    <!-- PAINEL ENTRADA -->
    <div id="painel-entrada" style="display:none">
      ${checkEntrada ? _renderChecklistExistente(checkEntrada) : (checkSaida ? _renderFormChecklist('entrada', locId, loc) : '<div style="text-align:center;padding:30px;color:var(--muted2)">⚠️ Faça o checklist de saída primeiro.</div>')}
    </div>

    <!-- BOTÃO DEVOLUÇÃO -->
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border2)">
      <button class="btn btn-primary" style="width:100%" onclick="confirmarDevolucao('${loc.id}','${loc.veiculo_id}','${loc.veiculos?.marca||''} ${loc.veiculos?.modelo||''}');closeModal('locacao-detalhe')">
        ✅ Confirmar devolução do veículo
      </button>
    </div>
  `;

  // Carrega itens do checklist filtrado por tipo de veículo
  await _carregarItensChecklist(loc.veiculos?.tipo || 'moto');

  // Se checklist de entrada existe, carrega custos registrados no financeiro
  if(checkEntrada){
    const {data:lancCustos} = await sb.from('lancamentos')
      .select('*')
      .eq('locacao_id', locId)
      .eq('origem','checklist_entrada')
      .order('id');
    if(lancCustos?.length){
      // Renderiza custos da entrada como view (somente leitura)
      const custosDiv = document.getElementById('custos-view-entrada');
      if(custosDiv){
        const total = lancCustos.reduce((a,l)=>a+Number(l.valor||0), 0);
        custosDiv.innerHTML = `
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:8px">💸 Custos Registrados na Devolução</div>
          <div style="background:var(--bg2);border-radius:10px;padding:12px">
            ${lancCustos.map(l=>`
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:15px">${l.categoria==='Tag / Pedágio'?'🛣️':l.categoria==='Reparo'?'🔧':l.categoria==='Lavagem'?'🫧':'⚠️'}</span>
              <div style="flex:1">
                <div style="font-size:11px;font-weight:700;color:var(--text)">${l.descricao?.split(' — ')[0]||l.categoria}</div>
                ${l.descricao?.split(' — ').slice(3).join(' — ')?`<div style="font-size:10px;color:var(--muted2)">${l.descricao.split(' — ').slice(3).join(' — ')}</div>`:''}
              </div>
              <span style="font-size:13px;font-weight:700;color:var(--red,#dc2626)">− R$ ${Number(l.valor||0).toFixed(2).replace('.',',')}</span>
            </div>`).join('')}
            <div style="text-align:right;font-size:13px;font-weight:700;color:var(--accent);padding-top:8px">
              Total: R$ ${total.toFixed(2).replace('.',',')}
            </div>
          </div>`;
        custosDiv.style.display = '';
      }
    }
  }
}

function showLocTab(tab){
  document.getElementById('painel-saida').style.display  = tab==='saida'  ? '' : 'none';
  document.getElementById('painel-entrada').style.display = tab==='entrada' ? '' : 'none';
  // Mostrar bloco de custos somente na aba entrada
  const bCustos = document.getElementById('bloco-custos-devolucao');
  if(bCustos){ bCustos.style.display = tab==='entrada' ? '' : 'none'; }
  if(tab==='entrada'){ _custosDevolucao=[]; _renderCustosDevolucao(); }
  document.querySelectorAll('.loc-tab').forEach(t=>{
    const isSaida = t.id==='tab-saida';
    const active = (tab==='saida')===isSaida;
    t.style.color = active?'var(--accent)':'var(--muted)';
    t.style.borderBottomColor = active?'var(--accent)':'transparent';
    t.style.fontWeight = active?'700':'600';
  });
}

function _fmtDtLocacao(str){
  if(!str) return '—';
  try{
    const d=new Date(str);
    return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  }catch(e){ return str; }
}

// ══ RENDER CHECKLIST EXISTENTE (só leitura) ══
function _renderChecklistExistente(check){
  const itens = check.itens||[];
  const fotos = check.fotos||[];
  const consultor = check.perfis?.nome||'—';
  return `
  <div style="background:var(--bg2);border-radius:10px;padding:16px;margin-bottom:12px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div><div style="font-size:10px;color:var(--muted2)">Horário</div><div style="font-weight:600;font-size:13px">${_fmtDtLocacao(check.horario)}</div></div>
      <div><div style="font-size:10px;color:var(--muted2)">Km</div><div style="font-weight:600;font-size:13px">${check.km||'—'} km</div></div>
      <div><div style="font-size:10px;color:var(--muted2)">Combustível</div><div style="font-weight:600;font-size:13px">${check.combustivel||'—'}</div></div>
      <div><div style="font-size:10px;color:var(--muted2)">Consultor</div><div style="font-weight:600;font-size:13px">${consultor}</div></div>
    </div>
    ${itens.length>0?`
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:8px">Itens vistoriados</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
      ${itens.map(it=>{
        const avaria  = it.status==='avaria';
        const naoHouve= it.status==='nao_houve';
        const badge   = avaria
          ? '<span style="font-size:10px;font-weight:700;color:#dc2626;background:rgba(220,38,38,.1);padding:2px 6px;border-radius:4px;white-space:nowrap">✕ Com avaria</span>'
          : naoHouve
          ? '<span style="font-size:10px;font-weight:700;color:#888;background:rgba(128,128,128,.1);padding:2px 6px;border-radius:4px;white-space:nowrap">— Não Houve</span>'
          : '<span style="font-size:10px;font-weight:700;color:#16a34a;background:rgba(22,163,74,.1);padding:2px 6px;border-radius:4px;white-space:nowrap">✓ Ok / Sem avaria</span>';
        return `<div style="background:var(--bg3,var(--bg2));border:1px solid ${avaria?'rgba(220,38,38,.2)':'var(--border)'};border-radius:6px;padding:6px 8px">
          <div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:3px">${it.descricao}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            ${badge}
            ${it.obs?`<span style="font-size:10px;color:var(--muted);font-style:italic">${it.obs}</span>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>`:''}
    ${check.observacoes?`<div style="margin-top:10px;font-size:12px;color:var(--muted)"><strong>Obs:</strong> ${check.observacoes}</div>`:''}
    ${fotos.length>0?`
    <div style="margin-top:12px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:8px">Fotos (${fotos.length})</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">
        ${fotos.map((url,fi)=>{
          const fid='foto'+Date.now()+fi;
          setTimeout(async()=>{
            const el=document.getElementById(fid);
            if(el){
              // URL já é signed URL direta do Supabase — usar diretamente
              const su = url.includes('supabase.co') ? url : (typeof _getSignedUrl==='function' ? await _getSignedUrl(url) : url);
              el.src=su;
              el.onclick=()=>window.open(su,'_blank');
            }
          },100+fi*50);
          return `<img id="${fid}" src="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;cursor:pointer;border:1px solid var(--border2)">`;
        }).join('')}
      </div>
    </div>`:''}
  </div>
  ${check.tipo==='entrada' ? '<div id="custos-view-entrada" style="display:none;margin-top:12px"></div>' : ''}
  `;
}

// ══ RENDER FORMULÁRIO DE CHECKLIST ══
function _renderFormChecklist(tipo, locId, loc){
  const label = tipo==='saida'?'Saída':'Entrada';
  return `
  <div id="form-checklist-${tipo}">
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="form-group">
        <label>Km atual</label>
        <input type="number" id="chk-km-${tipo}" placeholder="${loc.km_inicial||0}" style="width:100%">
      </div>
      <div class="form-group">
        <label>Nível de combustível</label>
        <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:10px">
          <div style="display:grid;grid-template-columns:repeat(9,1fr);gap:3px;margin-bottom:6px" id="gauge-${tipo}">
            ${['Reserva','1/8','2/8','3/8','4/8','5/8','6/8','7/8','Cheio'].map((v,i)=>`
              <div onclick="_selecionarComb('${tipo}','${['Reserva','1/8','2/8','3/8','4/8','5/8','6/8','7/8','Cheio'][i]}')" data-val="${['Reserva','1/8','2/8','3/8','4/8','5/8','6/8','7/8','Cheio'][i]}"
                style="height:28px;border-radius:4px;cursor:pointer;transition:.15s;border:2px solid transparent;
                background:${i===0?'#ef4444':i<3?'#f59e0b':i<6?'#22c55e':'#16a34a'}22"
                title="${['Reserva','1/8','2/8','3/8','4/8','5/8','6/8','7/8','Cheio'][i]}">
              </div>`).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted2);padding:0 2px">
            <span>Reserva</span><span>Cheio</span>
          </div>
          <div id="comb-label-${tipo}" style="text-align:center;font-size:12px;font-weight:700;color:var(--accent);margin-top:4px">Cheio</div>
          <input type="hidden" id="chk-comb-${tipo}" value="Cheio">
        </div>
      </div>
      <div class="form-group">
        <label>Horário da vistoria</label>
        <input type="datetime-local" id="chk-hora-${tipo}" style="width:100%" value="${new Date(new Date().getTime()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16)}">
      </div>
    </div>

    <!-- ITENS DO CHECKLIST -->
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:10px">Itens de vistoria</div>
    <div id="chk-itens-${tipo}" style="margin-bottom:16px">
      <div style="text-align:center;padding:20px;color:var(--muted2);font-size:13px">⏳ Carregando itens...</div>
    </div>

    <!-- FOTOS -->
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:8px">📷 Fotos (máx. 20)</div>
      <label style="display:flex;align-items:center;gap:8px;padding:12px;background:var(--bg2);border:2px dashed var(--border2);border-radius:10px;cursor:pointer;transition:border-color .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)'">
        <span style="font-size:20px">📷</span>
        <div>
          <div style="font-size:13px;font-weight:500">Selecionar fotos</div>
          <div style="font-size:11px;color:var(--muted)">Até 20 fotos — JPG, PNG, WEBP</div>
        </div>
        <input type="file" accept="image/*" multiple style="display:none" onchange="_previewFotos(this,'${tipo}')">
      </label>
      <div id="fotos-preview-${tipo}" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:8px"></div>
    </div>

    <!-- OBSERVAÇÕES -->
    <div class="form-group" style="margin-bottom:16px">
      <label>Observações da vistoria</label>
      <textarea id="chk-obs-${tipo}" rows="2" style="width:100%;resize:vertical" placeholder="Descreva avarias, itens faltantes..."></textarea>
    </div>

    <div id="bloco-custos-devolucao" style="margin-bottom:16px;display:none">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted2);margin-bottom:8px">💸 Custos da Devolução</div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">
          <button type="button" onclick="_addCustoDevolucao('Tag / Pedágio')"
            style="padding:7px 4px;border-radius:8px;border:1px solid var(--border2);background:var(--bg);cursor:pointer;font-size:11px;font-weight:600;color:var(--text)">
            🛣️ Tag / Pedágio
          </button>
          <button type="button" onclick="_addCustoDevolucao('Reparo')"
            style="padding:7px 4px;border-radius:8px;border:1px solid var(--border2);background:var(--bg);cursor:pointer;font-size:11px;font-weight:600;color:var(--text)">
            🔧 Reparo
          </button>
          <button type="button" onclick="_addCustoDevolucao('Lavagem')"
            style="padding:7px 4px;border-radius:8px;border:1px solid var(--border2);background:var(--bg);cursor:pointer;font-size:11px;font-weight:600;color:var(--text)">
            🫧 Lavagem
          </button>
          <button type="button" onclick="_addCustoDevolucao('Multa')"
            style="padding:7px 4px;border-radius:8px;border:1px solid var(--border2);background:var(--bg);cursor:pointer;font-size:11px;font-weight:600;color:var(--text)">
            ⚠️ Multa
          </button>
        </div>
        <div id="custos-lista-entrada" style="margin-bottom:6px"></div>
        <div id="custos-total-entrada" style="text-align:right;font-size:12px;font-weight:700;color:var(--accent);padding-top:6px;border-top:1px solid var(--border2);display:none">
          Total: R$ <span id="custos-total-val">0,00</span>
        </div>
      </div>
    </div>

    <button class="btn btn-primary" style="width:100%" onclick="salvarChecklist('${tipo}','${locId}')">
      💾 Salvar vistoria de ${label}
    </button>
  </div>`;
}

// ══ CARREGA ITENS DO CHECKLIST DO BANCO ══
async function _carregarItensChecklist(tipoVeiculo){
  // Limpa cache ao trocar tipo
  if(tipoVeiculo && _checklistItens._tipoCarregado !== tipoVeiculo){
    _checklistItens = [];
  }
  if(_checklistItens.length) return _renderItensNosFormularios();
  const tipo = tipoVeiculo || 'moto';
  const {data} = await sb.from('checklist_itens')
    .select('*')
    .eq('ativo', true)
    .in('tipo_veiculo', [tipo, 'ambos'])
    .order('ordem');
  _checklistItens = data||[];
  _checklistItens._tipoCarregado = tipo;
  _renderItensNosFormularios();
}

function _renderItensNosFormularios(){
  ['saida','entrada'].forEach(tipo=>{
    const wrap = document.getElementById(`chk-itens-${tipo}`);
    if(!wrap) return;
    if(!_checklistItens.length){
      wrap.innerHTML='<div style="color:var(--muted2);font-size:13px;text-align:center;padding:10px">Nenhum item configurado. Configure em Configurações.</div>';
      return;
    }
    // Agrupa por categoria
    const cats = {};
    _checklistItens.forEach(it=>{
      if(!cats[it.categoria]) cats[it.categoria]=[];
      cats[it.categoria].push(it);
    });
    wrap.innerHTML = Object.entries(cats).map(([cat,itens])=>`
      <div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:6px;padding:4px 0;border-bottom:1px solid var(--border2)">${cat}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${itens.map(it=>`
          <div style="background:var(--bg2);border-radius:8px;padding:8px 10px">
            <div style="font-size:12px;font-weight:500;margin-bottom:6px">${it.descricao}</div>
            <div style="display:flex;gap:4px">
              <label style="flex:1;text-align:center;padding:5px 2px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;border:2px solid #16a34a;color:#16a34a;background:rgba(22,163,74,.08);transition:all .15s" onclick="_selectItem(this,'ok')">
                <input type="radio" name="chk-${tipo}-${it.id}" value="ok" style="display:none" checked> ✓ Sem avaria
              </label>
              <label style="flex:1;text-align:center;padding:5px 2px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;border:2px solid #dc2626;color:#dc2626;background:#fff;transition:all .15s" onclick="_selectItem(this,'avaria')">
                <input type="radio" name="chk-${tipo}-${it.id}" value="avaria" style="display:none"> ✕ Com avaria
              </label>
            </div>
            <input type="text" placeholder="Obs (opcional)" style="width:100%;font-size:11px;margin-top:4px;padding:3px 6px;border-radius:4px"
              id="chk-obs-item-${tipo}-${it.id}">
          </div>`).join('')}
        </div>
      </div>`).join('');
  });
}

function _selecionarComb(tipo, valor){
  const inp = document.getElementById('chk-comb-'+tipo);
  const lbl = document.getElementById('comb-label-'+tipo);
  const gauge = document.getElementById('gauge-'+tipo);
  if(inp) inp.value = valor;
  if(lbl) lbl.textContent = valor;
  if(gauge){
    const cells = gauge.querySelectorAll('div[data-val]');
    const niveis = ['Reserva','1/8','2/8','3/8','4/8','5/8','6/8','7/8','Cheio'];
    const idx = niveis.indexOf(valor);
    cells.forEach((cell,i)=>{
      const isActive = i <= idx;
      const baseColor = i===0?'#ef4444':i<3?'#f59e0b':i<6?'#22c55e':'#16a34a';
      cell.style.background = isActive ? baseColor : baseColor+'22';
      cell.style.border = isActive ? '2px solid '+baseColor : '2px solid transparent';
    });
  }
}

function _selectItem(label, status){
  const parent = label.closest('div[style*="display:flex"]');
  if(!parent) return;
  // Reset todos
  parent.querySelectorAll('label').forEach(l=>{
    const isOk = l.textContent.includes('Sem avaria');
    const isAv = l.textContent.includes('Com avaria');
    l.style.background = isOk?'rgba(22,163,74,.08)':'rgba(220,38,38,.08)';
    l.style.color = isOk?'#16a34a':'#dc2626';
    l.style.borderColor = isOk?'#16a34a':'#dc2626';
    l.style.borderWidth='2px';
    l.style.opacity='1';
    l.style.boxShadow='none';
  });
  // Destaca selecionado com fundo sólido
  const bgColors = {ok:'#16a34a', avaria:'#dc2626', nao_verificado:'#475569'};
  label.style.background = bgColors[status];
  label.style.color = '#fff';
  label.style.borderColor = bgColors[status];
  label.style.opacity = '1';
  label.style.boxShadow = '0 2px 8px rgba(0,0,0,.18)';
  label.querySelector('input[type=radio]').checked = true;
}

// ══ PREVIEW DE FOTOS ══
function _previewFotos(input, tipo){
  const files = Array.from(input.files).slice(0,20);
  const wrap = document.getElementById(`fotos-preview-${tipo}`);
  if(!wrap) return;
  wrap.innerHTML = '';
  window[`_fotos_${tipo}`] = files;
  files.forEach((file,i)=>{
    const reader = new FileReader();
    reader.onload = e=>{
      const div = document.createElement('div');
      div.style.cssText='position:relative';
      div.innerHTML=`
        <img src="${e.target.result}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;border:1px solid var(--border2)">
        <button onclick="this.parentElement.remove();window['_fotos_${tipo}'].splice(${i},1)"
          style="position:absolute;top:3px;right:3px;background:rgba(0,0,0,.6);border:none;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>`;
      wrap.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

// ══ SALVAR CHECKLIST ══
async function salvarChecklist(tipo, locId){
  const km     = parseInt(document.getElementById(`chk-km-${tipo}`)?.value)||null;
  const comb   = document.getElementById(`chk-comb-${tipo}`)?.value||'';
  const hora   = document.getElementById(`chk-hora-${tipo}`)?.value||new Date().toISOString();
  const obs    = document.getElementById(`chk-obs-${tipo}`)?.value||'';
  const fotos  = window[`_fotos_${tipo}`]||[];

  const btn = document.querySelector(`#form-checklist-${tipo} .btn-primary`);
  if(btn){ btn.disabled=true; btn.textContent='Salvando...'; }

  try{
    // Coleta itens do formulário
    const itens = _checklistItens.map(it=>{
      const radios = document.querySelectorAll(`input[name="chk-${tipo}-${it.id}"]`);
      const checked = [...radios].find(r=>r.checked);
      const obsItem = document.getElementById(`chk-obs-item-${tipo}-${it.id}`)?.value||'';
      return {
        id:it.id, descricao:it.descricao, categoria:it.categoria,
        status: checked?.value||'nao_verificado',
        obs: obsItem
      };
    });

    // Upload das fotos para Supabase Storage
    const fotoUrls = [];
    for(const file of fotos){
      const ext = file.name.split('.').pop();
      const path = `${locId}/${tipo}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const {data:up, error:upErr} = await sb.storage.from('checklists').upload(path, file);
      if(upErr) throw upErr;
      const {data:signData} = await sb.storage.from('checklists').createSignedUrl(path, 60*60*24*365);
      fotoUrls.push(signData?.signedUrl || '');
    }

    // Salva checklist no banco
    const {error} = await sb.from('checklists').insert({
      locacao_id: locId,
      tipo,
      km,
      combustivel: comb,
      horario: hora,
      consultor_id: currentUser?.id,
      itens,
      observacoes: obs,
      fotos: fotoUrls
    });
    if(error) throw error;

    notify(`Vistoria de ${tipo==='saida'?'saída':'entrada'} salva!`,'success');

    // Se for entrada, registrar custos no financeiro
    if(tipo==='entrada' && _custosDevolucao.length){
      const loc = (await sb.from('locacoes').select('*, veiculos(*), clientes(*)').eq('id', locId).single()).data;
      for(const custo of _custosDevolucao){
        if(!custo.valor || custo.valor<=0) continue;
        await sb.from('lancamentos').insert({
          tipo:        'despesa',
          categoria:   custo.categoria,
          descricao:   `${custo.nome||custo.categoria} — ${loc?.clientes?.nome||''} — ${loc?.veiculos?.placa||''} [Devolução Contrato #${loc?.num_contrato||locId.slice(0,8)}]${custo.observacao?' — '+custo.observacao:''}`,
          valor:        custo.valor,
          data:         new Date().toISOString().slice(0,10),
          veiculo_id:   loc?.veiculo_id||null,
          locacao_id:   locId,
          origem:       'checklist_entrada',
          criado_por:   currentUser?.id,
        });
      }
      _custosDevolucao = []; // limpa após salvar
      notify(`${_custosDevolucao.length} custo(s) registrados no financeiro!`,'success');
    }

    // Reabre o modal atualizado
    closeModal('locacao-detalhe');
    setTimeout(()=>abrirModalLocacao(locId), 200);
  }catch(e){
    notify('Erro: '+e.message,'error');
    if(btn){ btn.disabled=false; btn.textContent=`💾 Salvar vistoria de ${tipo==='saida'?'Saída':'Entrada'}`; }
  }
}

// ══ ABRIR MODAL DIRETO NA ABA ENTRADA (botão Devolver da tabela) ══
async function abrirModalLocacaoEntrada(locId){
  await abrirModalLocacao(locId);
  // Aguarda o modal renderizar e muda para aba Entrada
  setTimeout(()=>{
    const tabEntrada = document.getElementById('tab-entrada');
    if(tabEntrada) tabEntrada.click();
    // Scroll até o painel de entrada
    const painel = document.getElementById('painel-entrada');
    if(painel) painel.scrollIntoView({behavior:'smooth', block:'start'});
  }, 350);
}

// ══ CUSTOS DA DEVOLUÇÃO ══
let _custosDevolucao = [];

function _addCustoDevolucao(categoria){
  const id = Date.now();
  _custosDevolucao.push({id, categoria, nome:'', valor:0, observacao:''});
  _renderCustosDevolucao();
}

function _removeCusto(id){
  _custosDevolucao = _custosDevolucao.filter(c=>c.id!==id);
  _renderCustosDevolucao();
}

function _renderCustosDevolucao(){
  const wrap = document.getElementById('custos-lista-entrada');
  const totalWrap = document.getElementById('custos-total-entrada');
  if(!wrap) return;

  if(!_custosDevolucao.length){
    wrap.innerHTML = '<div style="text-align:center;padding:10px;color:var(--muted2);font-size:12px">Nenhum custo adicionado</div>';
    if(totalWrap) totalWrap.style.display='none';
    return;
  }

  wrap.innerHTML = _custosDevolucao.map(c=>`
    <div id="custo-row-${c.id}" style="display:grid;grid-template-columns:28px 1fr 100px 1fr 28px;gap:8px;align-items:center;padding:10px 12px;margin-bottom:6px;background:var(--bg3,var(--bg));border-radius:10px;border:1px solid var(--border2)">
      <span style="font-size:18px;text-align:center">${c.categoria==='Tag / Pedágio'?'🛣️':c.categoria==='Reparo'?'🔧':c.categoria==='Lavagem'?'🫧':'⚠️'}</span>
      <div>
        <div style="font-size:9px;color:var(--muted2);margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px">${c.categoria}</div>
        <input type="text" placeholder="Descrição do custo" value="${c.nome}"
          oninput="_custosDevolucao.find(x=>x.id===${c.id}).nome=this.value"
          style="width:100%;font-size:12px;padding:5px 8px;border-radius:6px;background:var(--bg2);border:1px solid var(--border2);color:var(--text)">
      </div>
      <div>
        <div style="font-size:9px;color:var(--muted2);margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px">Valor (R$)</div>
        <input type="number" placeholder="0,00" value="${c.valor||''}" step="0.01" min="0"
          oninput="_custosDevolucao.find(x=>x.id===${c.id}).valor=parseFloat(this.value)||0;_recalcularTotalCustos()"
          style="font-size:12px;padding:5px 8px;border-radius:6px;background:var(--bg2);border:1px solid var(--border2);color:var(--text);width:100%">
      </div>
      <div>
        <div style="font-size:9px;color:var(--muted2);margin-bottom:2px;text-transform:uppercase;letter-spacing:.5px">Observação</div>
        <input type="text" placeholder="Opcional" value="${c.observacao}"
          oninput="_custosDevolucao.find(x=>x.id===${c.id}).observacao=this.value"
          style="width:100%;font-size:12px;padding:5px 8px;border-radius:6px;background:var(--bg2);border:1px solid var(--border2);color:var(--text)">
      </div>
      <button onclick="_removeCusto(${c.id})" title="Remover" style="background:none;border:none;cursor:pointer;font-size:20px;color:var(--red,#dc2626);padding:0;line-height:1;align-self:center">×</button>
    </div>`).join('');

  _recalcularTotalCustos();
  if(totalWrap) totalWrap.style.display = _custosDevolucao.length ? '' : 'none';
}

function _recalcularTotalCustos(){
  const total = _custosDevolucao.reduce((a,c)=>a+(c.valor||0), 0);
  const el = document.getElementById('custos-total-val');
  const wrap = document.getElementById('custos-total-entrada');
  if(el) el.textContent = total.toFixed(2).replace('.',',');
  if(wrap) wrap.style.display = _custosDevolucao.length ? '' : 'none';
}
