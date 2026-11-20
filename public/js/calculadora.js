// Calculadora integrada del examen (RF-18): solo aparece si el docente la permite. Está en la misma página,
// así que usarla no cuenta como cambio de pestaña. Evalúa + − × ÷, paréntesis y decimales sin eval
// (la CSP lo prohíbe y aceptaría código); cualquier otro carácter es un error.
function evaluarExpresion(texto) {
  const s = String(texto).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.').replace(/\s+/g, '');
  if (!s || s.length > 200) throw new Error('Escribe una operación.');
  let i = 0;
  const invalida = () => { throw new Error('Operación no válida.'); };

  function factor() {
    if (s[i] === '-') { i++; return -factor(); }
    if (s[i] === '+') { i++; return factor(); }
    if (s[i] === '(') {
      i++;
      const v = suma();
      if (s[i] !== ')') invalida();
      i++;
      return v;
    }
    const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (!m) invalida();
    i += m[0].length;
    return Number(m[0]);
  }
  function producto() {
    let v = factor();
    while (s[i] === '*' || s[i] === '/') {
      const op = s[i++];
      const d = factor();
      v = op === '*' ? v * d : v / d;
    }
    return v;
  }
  function suma() {
    let v = producto();
    while (s[i] === '+' || s[i] === '-') {
      const op = s[i++];
      const d = producto();
      v = op === '+' ? v + d : v - d;
    }
    return v;
  }

  const v = suma();
  if (i !== s.length) invalida();
  if (!Number.isFinite(v)) throw new Error('No se puede dividir entre cero.');
  return Number(v.toPrecision(12)); // 0.1 + 0.2 muestra 0.3
}

function iniciarCalculadora() {
  const entrada = document.getElementById('calc-entrada');
  const resultado = document.getElementById('calc-resultado');
  if (!entrada) return;
  const calcular = () => {
    try {
      const v = evaluarExpresion(entrada.value);
      resultado.textContent = `${entrada.value} = ${v}`;
      entrada.value = String(v);
    } catch (err) {
      resultado.textContent = err.message;
    }
  };
  document.getElementById('calc-teclas').addEventListener('click', (e) => {
    const tecla = e.target.closest('button')?.dataset.tecla;
    if (!tecla) return;
    if (tecla === '=') calcular();
    else if (tecla === 'C') { entrada.value = ''; resultado.textContent = ''; }
    else if (tecla === '⌫') entrada.value = entrada.value.slice(0, -1);
    else entrada.value += tecla;
  });
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); calcular(); }
    if (e.key === 'Escape') { entrada.value = ''; resultado.textContent = ''; }
  });
}

if (typeof document !== 'undefined') iniciarCalculadora();
