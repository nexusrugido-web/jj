import React, { useState } from 'react';

/* A foto da pessoa, ou as iniciais do nome (ou do apelido) quando
   ela não colocou foto. Se a foto não carregar, volta pras iniciais. */
export const iniciais = (nome) => String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2)
  .map((p) => p[0]).join('').toUpperCase();

export default function Avatar({ nome, foto, className = '', children }) {
  const [quebrou, setQuebrou] = useState(false);
  return (
    <span className={`avatar ${className}`}>
      {foto && !quebrou
        ? <img src={foto} alt="" loading="lazy" onError={() => setQuebrou(true)} />
        : iniciais(nome)}
      {children}
    </span>
  );
}
