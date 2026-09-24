import React, { useState } from 'react';
import { Mail, KeyRound, UserPlus, ArrowLeft, Check } from 'lucide-react';
import { Btn, Field, Input, Seg, useToast } from '../components/UI';
import { Ponteira } from '../components/Ponteira';
import {
  supabaseConfigurado, entrarComSenha, cadastrar, entrarComGoogle,
  recuperarSenha, trocarSenha, traduzErro,
} from '../lib/supabase';

export default function Login({ onPular, onPronto, modoInicial }) {
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
        /* e-mail que já tem conta volta sem erro e sem identidade, pra
           não revelar quem é cliente. Sem isso a tela dizia "olha seu
           e-mail" e nenhum e-mail chegava. */
        if (r?.user && Array.isArray(r.user.identities) && r.user.identities.length === 0) {
          throw new Error('User already registered');
        }
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
        /* trocar a senha não é "entrar": sem fechar aqui, a tela
           ficava parada pedindo a senha que acabou de ser salva */
        onPronto?.();
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

  const trocar = (m) => { setModo(m); setEnviado(false); };
  const entrando = modo === 'entrar' || modo === 'criar';

  if (!supabaseConfigurado) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <Marca />
          <h1 className="login-titulo">Seus treinos ficam neste aparelho</h1>
          <p className="login-sub">Dá pra usar tudo sem conta. Os treinos ficam salvos aqui mesmo.</p>
          <Btn variant="primary" onClick={onPular} className="login-cta">
            Começar
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <Marca />

        {enviado ? (
          <div className="login-enviado">
            <span className="login-enviado-ico"><Check size={22} /></span>
            <h1 className="login-titulo" style={{ textAlign: 'center' }}>Olha o seu e-mail</h1>
            <p className="login-sub" style={{ textAlign: 'center' }}>
              Mandamos um link para <b style={{ color: 'var(--chalk)' }}>{email}</b>. Abre ele neste aparelho e você volta
              direto pra cá.
            </p>
            <Btn onClick={() => trocar('entrar')} className="login-cta">Voltar</Btn>
          </div>
        ) : (
          <>
            {entrando ? (
              <>
                <h1 className="login-titulo">Cada rola vira o mapa do seu jogo</h1>
                <p className="login-sub">
                  Registre o treino e veja as suas técnicas subirem de grau, rola por rola.
                </p>
                <Exemplo />
              </>
            ) : (
              <>
                <h1 className="login-titulo">
                  {modo === 'nova_senha' ? 'Escolha a senha nova' : 'Esqueceu a senha?'}
                </h1>
                <p className="login-sub">
                  {modo === 'nova_senha'
                    ? 'Você chegou aqui pelo link do e-mail. Define a senha nova e pronto.'
                    : 'Digite o seu e-mail que a gente manda um link pra criar uma senha nova.'}
                </p>
              </>
            )}

            {entrando && (
              <>
                <Seg
                  value={modo}
                  onChange={trocar}
                  options={[{ id: 'entrar', nome: 'Entrar' }, { id: 'criar', nome: 'Criar conta' }]}
                />
                <button
                  type="button"
                  className="btn login-google"
                  onClick={() => entrarComGoogle().catch((e) => toast(traduzErro(e), 'err'))}
                >
                  <LogoGoogle /> Continuar com Google
                </button>
                <div className="login-ou"><span>ou com e-mail</span></div>
              </>
            )}

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
                <Field label={modo === 'nova_senha' ? 'Senha nova' : 'Senha'} hint={modo !== 'entrar' ? 'Pelo menos 6 caracteres.' : undefined}>
                  <Input
                    type="password" required minLength={6}
                    autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                    value={senha} onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                  />
                </Field>
              )}
              {modo === 'entrar' && (
                <button type="button" className="login-link" onClick={() => trocar('recuperar')}>Esqueci a senha</button>
              )}

              <Btn
                type="submit" variant="primary"
                icon={modo === 'criar' ? UserPlus : modo === 'recuperar' ? Mail : KeyRound}
                disabled={carregando}
                className="login-cta"
              >
                {carregando ? 'Um instante…'
                  : modo === 'entrar' ? 'Entrar'
                  : modo === 'criar' ? 'Criar minha conta'
                  : modo === 'nova_senha' ? 'Salvar senha nova'
                  : 'Mandar o link'}
              </Btn>
            </form>

            {modo === 'recuperar' && (
              <button type="button" className="login-link centro" onClick={() => trocar('entrar')}>
                <ArrowLeft size={12} /> Voltar pro login
              </button>
            )}
            {modo === 'nova_senha' && (
              <button
                type="button" className="login-link centro"
                onClick={() => { history.replaceState({}, '', location.pathname); trocar('recuperar'); }}
              >
                O link não funcionou? Pedir outro
              </button>
            )}

            {entrando && (
              <div className="login-sem-conta">
                <button type="button" className="login-link centro" onClick={onPular}>
                  Continuar sem conta
                </button>
                <span className="micro muted">Os treinos ficam só neste aparelho. Dá pra criar a conta depois.</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Marca() {
  return (
    <div className="login-marca">
      <span className="brand-mark" />
      <div>
        <div className="brand-name">NeuroJitsu</div>
        <div className="brand-sub">jiu-jitsu</div>
      </div>
    </div>
  );
}

/* O que o app faz, mostrado em vez de explicado: uma técnica
   perto de subir de grau, igual ela aparece no Painel. */
function Exemplo() {
  return (
    <div className="login-exemplo" aria-hidden="true">
      <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
        <span className="login-exemplo-nome">Chave de braço</span>
        <span className="login-exemplo-grau"><Ponteira n={2} mini /> Funciona no rola</span>
      </div>
      <div className="tec-home-barra"><i style={{ width: '80%', background: 'var(--roar)' }} /></div>
      <div className="login-exemplo-pe">Falta 1 vez no rola pra subir pro 3º grau</div>
    </div>
  );
}

function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
