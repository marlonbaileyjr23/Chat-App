const form = document.getElementById('reg-form');
form.addEventListener('submit', registerUser);

async function registerUser(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const result = await fetch('/api/register',{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username, 
            password
        })
    }).then(res => res.json());
    
    if(result.status==='ok'){
        alert('User registered successfully');
        window.location.assign('index.html');
    }else{
        alert(result.error);
    }
}