#!/usr/bin/env python3
"""
Aplica automaticamente o PASSO A/B no bridge server:
- Substitui o endpoint /api/enviar-mensagem existente (adiciona suporte
  a resposta/quoted)
- Adiciona 2 endpoints novos: /api/enviar-midia e /api/deletar-mensagem

Uso:
    python3 aplicar_passo_ab.py /root/fleetpro-bridge/fleetpro-bridge-server.js

O script:
  1. Faz backup do arquivo original (.bak com timestamp)
  2. Localiza o endpoint /api/enviar-mensagem original (texto exato)
  3. Substitui por: nova versão do enviar-mensagem + 2 endpoints novos
  4. Roda `node --check` no resultado
  5. Se a sintaxe falhar, RESTAURA o backup automaticamente e avisa
"""

import sys
import subprocess
import shutil
import datetime

ENDPOINT_ORIGINAL = """app.post('/api/enviar-mensagem', async (req, res) => {
  const secret = req.headers['x-secret'] || req.query.secret;
  if (secret !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  try{
    const { numero, texto, clienteId, nomeAtendente } = req.body;
    if(!numero || !texto) return res.status(400).json({ error: 'numero e texto obrigatórios' });

    // Busca config Evolution do banco
    const EVO_URL = process.env.EVO_URL || 'https://evo.ruahsystems.com.br';
    const EVO_KEY = process.env.EVO_KEY || '65AAC74F7A54-40A1-A6B7-135DFF8C28C2';
    const INSTANCIA = process.env.EVO_INSTANCIA || 'royalevo';

    // Envia pelo Evolution
    const r = await fetch(`${EVO_URL}/message/sendText/${INSTANCIA}`, {
      method: 'POST',
      headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: numero, text: texto, delay: 500 })
    });
    if(!r.ok){ const t = await r.text(); throw new Error(t); }

    // Salva no banco imediatamente
    const numLimpo = numero.replace(/\\D/g,'').slice(-11);
    const { data: cli } = await sb.from('clientes').select('id').ilike('telefone', `%${numLimpo}`).maybeSingle();
    const cId = clienteId || cli?.id || null;

    const { data: msgSalva } = await sb.from('wpp_mensagens').insert({
      cliente_id: cId,
      numero: numero.replace(/\\D/g,''),
      texto,
      tipo: 'text',
      direcao: 'saida',
      media_url: null
    }).select().single();

    // Broadcast SSE para outros atendentes verem em tempo real
    broadcast({
      tipo: 'wpp_msg_recebida',
      id: msgSalva?.id || Date.now().toString(),
      numero: numero.replace(/\\D/g,''),
      clienteId: cId,
      nomeCliente: nomeAtendente || '👤 Atendente',
      texto,
      tipoMsg: 'text',
      fromMe: true,
      atendente: true,
      createdAt: new Date().toISOString()
    });

    console.log(`[enviar-mensagem] ${numero}: "${texto.slice(0,50)}"`);
    res.json({ ok: true, id: msgSalva?.id });
  }catch(e){
    console.error('[enviar-mensagem]', e.message);
    res.status(500).json({ error: e.message });
  }
});"""

BLOCO_NOVO = """app.post('/api/enviar-mensagem', async (req, res) => {
  const secret = req.headers['x-secret'] || req.query.secret;
  if (secret !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  try{
    const { numero, texto, clienteId, nomeAtendente, quotedMsgId } = req.body;
    if(!numero || !texto) return res.status(400).json({ error: 'numero e texto obrigatórios' });

    const EVO_URL = process.env.EVO_URL || 'https://evo.ruahsystems.com.br';
    const EVO_KEY = process.env.EVO_KEY || '65AAC74F7A54-40A1-A6B7-135DFF8C28C2';
    const INSTANCIA = process.env.EVO_INSTANCIA || 'royalevo';

    const body = { number: numero, text: texto, delay: 500 };

    let quotedRef = null;
    if(quotedMsgId){
      const { data: msgOriginal } = await sb.from('wpp_mensagens')
        .select('id,wpp_message_id,direcao,texto')
        .eq('id', quotedMsgId).maybeSingle();
      if(msgOriginal?.wpp_message_id){
        body.quoted = {
          key: {
            remoteJid: numero.replace(/\\D/g,'') + '@s.whatsapp.net',
            fromMe: msgOriginal.direcao === 'saida',
            id: msgOriginal.wpp_message_id
          },
          message: { conversation: msgOriginal.texto || '' }
        };
        quotedRef = msgOriginal.id;
      }
    }

    const r = await fetch(`${EVO_URL}/message/sendText/${INSTANCIA}`, {
      method: 'POST',
      headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if(!r.ok){ const t = await r.text(); throw new Error(t); }
    const evoResult = await r.json();
    const wppMessageId = evoResult?.key?.id || null;

    const numLimpo = numero.replace(/\\D/g,'').slice(-11);
    const { data: cli } = await sb.from('clientes').select('id').ilike('telefone', `%${numLimpo}`).maybeSingle();
    const cId = clienteId || cli?.id || null;

    const { data: msgSalva } = await sb.from('wpp_mensagens').insert({
      cliente_id: cId,
      numero: numero.replace(/\\D/g,''),
      texto,
      tipo: 'text',
      direcao: 'saida',
      media_url: null,
      wpp_message_id: wppMessageId,
      quoted_msg_id: quotedRef
    }).select().single();

    broadcast({
      tipo: 'wpp_msg_recebida',
      id: msgSalva?.id || Date.now().toString(),
      numero: numero.replace(/\\D/g,''),
      clienteId: cId,
      nomeCliente: nomeAtendente || '👤 Atendente',
      texto,
      tipoMsg: 'text',
      fromMe: true,
      atendente: true,
      createdAt: new Date().toISOString()
    });

    console.log(`[enviar-mensagem] ${numero}: "${texto.slice(0,50)}"${quotedRef ? ' (resposta)' : ''}`);
    res.json({ ok: true, id: msgSalva?.id });
  }catch(e){
    console.error('[enviar-mensagem]', e.message);
    res.status(500).json({ error: e.message });
  }
});


app.post('/api/enviar-midia', async (req, res) => {
  const secret = req.headers['x-secret'] || req.query.secret;
  if (secret !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  try{
    const { numero, tipo, base64, fileName, clienteId, nomeAtendente } = req.body;
    if(!numero || !tipo || !base64) return res.status(400).json({ error: 'numero, tipo e base64 obrigatórios' });
    if(!['audio','image','document'].includes(tipo)) return res.status(400).json({ error: 'tipo deve ser audio, image ou document' });

    const EVO_URL = process.env.EVO_URL || 'https://evo.ruahsystems.com.br';
    const EVO_KEY = process.env.EVO_KEY || '65AAC74F7A54-40A1-A6B7-135DFF8C28C2';
    const INSTANCIA = process.env.EVO_INSTANCIA || 'royalevo';

    let endpoint = '', body = {};
    if(tipo === 'audio'){
      endpoint = 'sendWhatsAppAudio';
      body = { number: numero, audio: base64, encoding: true };
    } else if(tipo === 'image'){
      endpoint = 'sendMedia';
      body = { number: numero, mediatype: 'image', media: base64, caption: '' };
    } else {
      endpoint = 'sendMedia';
      body = { number: numero, mediatype: 'document', media: base64, fileName: fileName || 'arquivo', caption: '' };
    }

    const r = await fetch(`${EVO_URL}/message/${endpoint}/${INSTANCIA}`, {
      method: 'POST',
      headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if(!r.ok){ const t = await r.text(); throw new Error(t); }
    const evoResult = await r.json();
    const wppMessageId = evoResult?.key?.id || null;

    let storageUrl = null;
    try{
      const buffer = Buffer.from(base64, 'base64');
      const ext = tipo === 'audio' ? 'ogg' : tipo === 'image' ? 'jpg' : (fileName?.split('.').pop() || 'bin');
      const nomeArquivo = `chat/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await sb.storage.from('wpp-media').upload(nomeArquivo, buffer, {
        contentType: tipo === 'audio' ? 'audio/ogg' : tipo === 'image' ? 'image/jpeg' : 'application/octet-stream'
      });
      if(!upErr){
        storageUrl = `${SB_URL}/storage/v1/object/public/wpp-media/${nomeArquivo}`;
      } else {
        console.warn('[enviar-midia] upload storage falhou:', upErr.message);
      }
    }catch(upEx){
      console.warn('[enviar-midia] erro no upload:', upEx.message);
    }

    const numLimpo = numero.replace(/\\D/g,'').slice(-11);
    const { data: cli } = await sb.from('clientes').select('id').ilike('telefone', `%${numLimpo}`).maybeSingle();
    const cId = clienteId || cli?.id || null;

    const { data: msgSalva } = await sb.from('wpp_mensagens').insert({
      cliente_id: cId,
      numero: numero.replace(/\\D/g,''),
      texto: fileName || (tipo === 'audio' ? 'Áudio' : tipo === 'image' ? 'Imagem' : 'Arquivo'),
      tipo,
      direcao: 'saida',
      media_url: storageUrl,
      wpp_message_id: wppMessageId
    }).select().single();

    broadcast({
      tipo: 'wpp_msg_recebida',
      id: msgSalva?.id || Date.now().toString(),
      numero: numero.replace(/\\D/g,''),
      clienteId: cId,
      nomeCliente: nomeAtendente || '👤 Atendente',
      texto: msgSalva?.texto || '',
      tipoMsg: tipo,
      mediaUrl: storageUrl,
      fromMe: true,
      atendente: true,
      createdAt: new Date().toISOString()
    });

    console.log(`[enviar-midia] ${numero}: ${tipo} salvo (${storageUrl ? 'com storage' : 'SEM storage'})`);
    res.json({ ok: true, id: msgSalva?.id, mediaUrl: storageUrl });
  }catch(e){
    console.error('[enviar-midia]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/deletar-mensagem', async (req, res) => {
  const secret = req.headers['x-secret'] || req.query.secret;
  if (secret !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  try{
    const { mensagemId } = req.body;
    if(!mensagemId) return res.status(400).json({ error: 'mensagemId obrigatório' });

    const { data: msg, error: errMsg } = await sb.from('wpp_mensagens')
      .select('id,numero,direcao,wpp_message_id').eq('id', mensagemId).maybeSingle();
    if(errMsg || !msg) return res.status(404).json({ error: 'Mensagem não encontrada' });
    if(msg.direcao !== 'saida') return res.status(400).json({ error: 'Só é possível apagar mensagens enviadas por você' });
    if(!msg.wpp_message_id) return res.status(400).json({ error: 'Mensagem sem ID do WhatsApp — não é possível apagar (mensagem antiga, anterior a esta funcionalidade)' });

    const EVO_URL = process.env.EVO_URL || 'https://evo.ruahsystems.com.br';
    const EVO_KEY = process.env.EVO_KEY || '65AAC74F7A54-40A1-A6B7-135DFF8C28C2';
    const INSTANCIA = process.env.EVO_INSTANCIA || 'royalevo';
    const remoteJid = msg.numero.replace(/\\D/g,'') + '@s.whatsapp.net';

    const r = await fetch(`${EVO_URL}/chat/deleteMessageForEveryone/${INSTANCIA}`, {
      method: 'DELETE',
      headers: { 'apikey': EVO_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: msg.wpp_message_id, remoteJid, fromMe: true })
    });
    if(!r.ok){ const t = await r.text(); throw new Error(t); }

    await sb.from('wpp_mensagens').update({ apagada: true }).eq('id', mensagemId);

    broadcast({ tipo: 'wpp_msg_apagada', id: mensagemId, numero: msg.numero });

    console.log(`[deletar-mensagem] ${mensagemId} apagada (${msg.numero})`);
    res.json({ ok: true });
  }catch(e){
    console.error('[deletar-mensagem]', e.message);
    res.status(500).json({ error: e.message });
  }
});"""


def main():
    if len(sys.argv) != 2:
        print("Uso: python3 aplicar_passo_ab.py /caminho/para/fleetpro-bridge-server.js")
        sys.exit(1)

    caminho = sys.argv[1]

    try:
        with open(caminho, 'r', encoding='utf-8') as f:
            conteudo = f.read()
    except FileNotFoundError:
        print(f"ERRO: arquivo não encontrado: {caminho}")
        sys.exit(1)

    if ENDPOINT_ORIGINAL not in conteudo:
        print("ERRO: não encontrei o endpoint /api/enviar-mensagem original no arquivo.")
        print("Isso pode significar que o arquivo já foi modificado, ou a versão é")
        print("diferente da esperada. Nenhuma mudança foi aplicada.")
        sys.exit(1)

    conteudo_novo = conteudo.replace(ENDPOINT_ORIGINAL, BLOCO_NOVO, 1)

    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    caminho_backup = f"{caminho}.bak_{timestamp}"
    shutil.copy2(caminho, caminho_backup)
    print(f"Backup salvo em: {caminho_backup}")

    with open(caminho, 'w', encoding='utf-8') as f:
        f.write(conteudo_novo)
    print(f"Arquivo modificado: {caminho}")

    resultado = subprocess.run(['node', '--check', caminho], capture_output=True, text=True)
    if resultado.returncode != 0:
        print("\nERRO DE SINTAXE após a modificação. Restaurando backup automaticamente...")
        print(resultado.stderr)
        shutil.copy2(caminho_backup, caminho)
        print(f"Arquivo restaurado a partir de {caminho_backup}. NENHUMA mudança foi aplicada.")
        sys.exit(1)

    print("\n✓ Sintaxe validada com sucesso (node --check).")
    print("✓ Endpoint /api/enviar-mensagem atualizado (suporte a resposta/quoted).")
    print("✓ Endpoint /api/enviar-midia adicionado.")
    print("✓ Endpoint /api/deletar-mensagem adicionado.")
    print("\nPróximo passo: docker service update --force fleetpro-bridge")


if __name__ == '__main__':
    main()
