const loginForm = document.getElementById("loginForm");
const loginFeedback = document.getElementById("loginFeedback");
const perfilEsperado = document.body.dataset.loginPerfil || "";
const destinoLogin = document.body.dataset.loginDestino || "/medicamentos";

async function sendJson(url, data) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.erro || body.mensagem || `Nao foi possivel concluir (${response.status})`);
  }

  return body;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginFeedback.textContent = "";

  const usuario = document.getElementById("loginNome").value.trim();
  const senha = document.getElementById("loginSenha").value;

  try {
    const result = await sendJson("/auth/login", { usuario, senha, perfil: perfilEsperado });
    sessionStorage.setItem("farmaeduk_autenticado", "true");
    sessionStorage.setItem("farmaeduk_usuario", JSON.stringify(result.usuario));
    sessionStorage.setItem("farmaeduk_token", result.token || "");
    window.location.href = destinoLogin;
  } catch (error) {
    loginFeedback.textContent = error.name === "AbortError" ? "A API demorou para responder. Verifique a Vercel e o banco." : error.message;
  }
});
