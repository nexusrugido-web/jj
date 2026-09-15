import React, { useState } from 'react';
import { LogIn, Mail, KeyRound, UserPlus, ArrowLeft, CloudOff, Check } from 'lucide-react';
import { Card, Btn, Field, Input, useToast, Chip } from '../components/UI';
import {
  supabaseConfigurado, entrarComSenha, cadastrar, entrarComGoogle,
  recuperarSenha, trocarSenha, traduzErro,
} from '../lib/supabase';

export default function Login({ onPular, modoInicial }) {
  const toast = useToast();
  const [modo, setModo] = useState(modoInicial || 'entrar'); // entrar | criar | recuperar | nova_senha
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e) {
    e?.preventDefault?.();
    if (carregando) return;
    setCarregando(true);
    try {
      if (modo === 'entrar') {
        await entrarComSenha(email.trim(), senha);
        toast('Bem-vindo de volta');
      } else if (modo === 'criar') {
        const r = await cadastrar(email.trim(), senha, nome);
        if (r?.user && !r?.session) {
          setEnviado(true);
          toast('Confirme o e-mail que enviamos');
        } else {
          toast('Conta criada');
        }
      } else if (modo === 'nova_senha') {
        if (senha.length < 6) throw new Error('Password should be at least 6 characters');
        await trocarSenha(senha);
        toast('Senha trocada. Bem-vindo de volta.');
        history.replaceState({}, '', location.pathname);
      } else {
        await recuperarSenha(email.trim());
        setEnviado(true);
        toast('Link de recuperação enviado');
      }
    } catch (err) {
      toast(traduzErro(err), 'err');
    } finally {
      setCarregando(false);
    }
  }

  if (!supabaseConfigurado) {
    return (
      <div className="login-wrap">
        <Card className="login-card">
          <Marca />
          <div className="row" style={{ gap: 10, alignItems: 'flex-start', marginTop: 18 }}>
            <span className="stat-ico"><CloudOff size={16} /></span>
            <div>
              <div style={{ fontWeight: 600 }}>Nuvem não configurada</div>
              <p className="tiny muted" style={{ marginTop: 4 }}>
                O app funciona 100% assim mesmo, seus dados ficam salvos no aparelho.
                Pra sincronizar entre celular e computador, adicione as variáveis
                <b style={{ color: 'var(--chalk)' }}> VITE_SUPABASE_URL</b> e
                <b style={{ color: 'var(--chalk)' }}> VITE_SUPABASE_ANON_KEY</b> na Vercel.
              </p>
            </div>
          </div>
          <Btn variant="primary" onClick={onPular} style={{ marginTop: 18, width: '100%' }}>
            Usar offline
          </Btn>
        </Card>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <Card className="login-card">
        <Marca />

        {enviado ? (
          <div className="col center" style={{ alignItems: 'center', gap: 14, padding: '22px 0' }}>
            <span className="stat-ico" style={{ width: 46, height: 46, color: 'var(--jade)', background: 'color-mix(in srgb, var(--jade) 14%, transparent)' }}>
              <Check size={22} />
            </span>
            <div className="center">
              <div style={{ fontWeight: 700, fontFamily: 'var(--display)', fontSize: 17 }}>Olha seu e-mail</div>
              <p className="tiny muted" style={{ marginTop: 6 }}>
                Mandamos um link para <b style={{ color: 'var(--chalk)' }}>{email}</b>. Clique nele e volte aqui.
              </p>
            </div>
            <Btn onClick={() => { setEnviado(false); setModo('entrar'); }}>Voltar</Btn>
          </div>
        ) : (
          <>
            <div style={{ marginTop: 20, marginBottom: 16 }}>
              <div className="eyebrow">
                {modo === 'entrar' ? 'entrar na conta' : modo === 'criar' ? 'criar conta'
                  : modo === 'nova_senha' ? 'senha nova' : 'recuperar senha'}
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 5, letterSpacing: '-0.03em' }}>
                {modo === 'entrar' ? 'Seus treinos, em qualquer aparelho'
                  : modo === 'criar' ? 'Bora começar'
                  : modo === 'nova_senha' ? 'Escolha a senha nova'
                  : 'Sem problema'}
              </h1>
              <p className="tiny muted" style={{ marginTop: 6 }}>
                {modo === 'recuperar'
                  ? 'Digite seu e-mail que mandamos um link pra criar uma senha nova.'
                  : modo === 'nova_senha'
                  ? 'Você chegou aqui pelo link do e-mail. Defina a senha e pronto.'
                  : 'Login sincroniza treinos, técnicas, vídeos e metas entre celular e computador.'}
              </p>
            </div>

            {modo === 'entrar' || modo === 'criar' ? (
              <>
                <Btn
                  icon={LogIn}
                  onClick={() => entrarComGoogle().catch((e) => toast(traduzErro(e), 'err'))}
                  style={{ width: '100%', minHeight: 46 }}
                >
                  Continuar com Google
                </Btn>
                <div className="row" style={{ gap: 10, margin: '16px 0' }}>
                  <span style={{ flex: 1, height: 1, background: 'var(--seam)' }} />
                  <span className="micro muted">ou com e-mail</span>
                  <span style={{ flex: 1, height: 1, background: 'var(--seam)' }} />
                </div>
              </>
            ) : null}

            <form onSubmit={enviar} className="col" style={{ gap: 12 }}>
              {modo === 'criar' && (
                <Field label="Como te chamam">
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" autoComplete="name" />
                </Field>
              )}
              {modo !== 'nova_senha' && (
                <Field label="E-mail">
                  <Input
                    type="email" inputMode="email" autoComplete="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@gmail.com"
                  />
                </Field>
              )}
              {modo !== 'recuperar' && (
                <Field label={modo === 'nova_senha' ? 'Nova senha' : 'Senha'} hint={modo !== 'entrar' ? 'Mínimo 6 caracteres.' : undefined}>
                  <Input
                    type="password" required minLength={6}
                    autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                    value={senha} onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                  />
                </Field>
              )}

              <Btn
                type="submit" variant="primary"
                icon={modo === 'criar' ? UserPlus : modo === 'recuperar' ? Mail : KeyRound}
                disabled={carregando}
                style={{ width: '100%', minHeight: 46, marginTop: 4 }}
              >
                {carregando ? 'Um instante…'
                  : modo === 'entrar' ? 'Entrar'
                  : modo === 'criar' ? 'Criar conta'
                  : modo === 'nova_senha' ? 'Salvar senha nova'
                  : 'Enviar link'}
              </Btn>
            </form>

            <div className="row" style={{ gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              {modo === 'entrar' && (
                <>
                  <button className="btn ghost xs" onClick={() => setModo('criar')}>Criar conta</button>
                  <button className="btn ghost xs" onClick={() => setModo('recuperar')}>Esqueci a senha</button>
                </>
              )}
              {modo !== 'entrar' && modo !== 'nova_senha' && (
                <button className="btn ghost xs" onClick={() => setModo('entrar')}><ArrowLeft size={12} /> Voltar pro login</button>
              )}
            </div>

            {modo !== 'nova_senha' && (
              <>
                <div className="divider" style={{ margin: '18px 0 14px' }} />
                <button className="btn ghost xs" onClick={onPular} style={{ width: '100%' }}>
                  Continuar sem conta (só neste aparelho)
                </button>
              </>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function Marca() {
  return (
    <div className="row" style={{ gap: 12 }}>
      <span className="brand-mark" style={{ width: 44, height: 44, borderRadius: 13 }} />
      <div>
        <div className="brand-name" style={{ fontSize: 19 }}>NeuroJitsu</div>
        <div className="brand-sub">jiu-jitsu</div>
      </div>
    </div>
  );
}
