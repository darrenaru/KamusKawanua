// ==============================
// LOGIN FORM HANDLER
// ==============================
console.log("LOGIN FILE LOADED");
const form = document.getElementById("loginForm");
const msg = document.getElementById("loginMsg");

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    // reset message
    msg.style.display = "none";
    msg.innerText = "";

    // VALIDATION
    if (!username || !password) {
        msg.style.display = "block";
        msg.className = "login-msg login-msg--error";
        msg.innerText = "All fields are required";
        return;
    }

    try {
        const res = await fetch("http://127.0.0.1:8000/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        msg.style.display = "block";

        if (data.success) {

            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("username", username);

            console.log("LOGIN DEBUG:");
            console.log("isLoggedIn =", localStorage.getItem("isLoggedIn"));
            console.log("username =", localStorage.getItem("username"));

            msg.className = "login-msg login-msg--success";
            msg.innerText = "Login successful";

            setTimeout(() => {
                window.location.href = "../admin/pages/dashboard.html";
            }, 1000);

        } else {
            msg.className = "login-msg login-msg--error";
            msg.innerText = data.message || "Login failed";
        }

    } catch (error) {
        msg.style.display = "block";
        msg.className = "login-msg login-msg--error";
        msg.innerText = "Server not reachable";
    }
});


// ==============================
// TOGGLE PASSWORD VISIBILITY
// ==============================

function togglePassword() {
    const password = document.getElementById("password");

    if (password.type === "password") {
        password.type = "text";
    } else {
        password.type = "password";
    }
}