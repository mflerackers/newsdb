class UploadField extends HTMLElement {
    constructor() {
        super();
        
        let shadow = this.attachShadow({mode: 'open'});
        
        let style = document.createElement('style');
        
        style.textContent = `.label { border: 1px solid silver; border-radius: 5px; font-size: 14px; line-height:17px; padding: 4px; display: block; }`;
        shadow.appendChild(style);
        
        let span = document.createElement("span");
        span.classList.add("label");
        span.innerText = "Drop a file here";
        shadow.appendChild(span);
    }
    
    get value() {
        return this.getAttribute("value");
    }
    
    set value(newValue) {
        this.setAttribute("value", newValue);
    }
    
    checkAuth(files) {
        const url = "/isauth";
        fetch(url, {
            method: 'GET'
        })
        .then((response) => {
            return response.json();
        })
        .then((json) => {
            console.log(json);
            if (json.authUrl) {
                console.log("opening window");
                let popup = window.open(json.authUrl, "ThaiDB", "location=0,status=0,width=800,height=400");
                if (popup) {
                    let timer = window.setInterval(()=>{
                        if (popup.closed) {
                            window.clearInterval(timer);
                            this.checkAuth(files);
                        }
                    }, 1000);
                }
                else {
                    /* Error. Inform the user */
                }
            }
            else {
                files.forEach(file=>{
                    this.uploadFile(file);
                });
            }
        })
        .catch(() => { /* Error. Inform the user */ })
    }
    
    uploadFile(file) {
        const url = this.getAttribute("url")
        const formData = new FormData()
        
        formData.append('file', file)
        
        fetch(url, {
            method: 'POST',
            body: formData
        })
        .then((response) => {
            return response.json();
        })
        .then((json) => {
            console.log(json);
            this.setAttribute("value", json.data.webViewLink);
        })
        .catch(() => { /* Error. Inform the user */ })
    }
    
    connectedCallback() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.addEventListener(eventName, (e)=>{
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName =>{
            this.addEventListener(eventName, (e)=>{
                this.style.backgroundColor = "red";
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName =>{
            this.addEventListener(eventName, (e)=>{
                this.style.backgroundColor = "white";
            }, false);
        });
        
        this.addEventListener("drop", (e)=>{
            this.style.backgroundColor = "white";
            const files = [...e.dataTransfer.files];
            this.checkAuth(files);
        });
    }
    
    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case "value":
            {
                let shadow = this.shadowRoot;
                let old = shadow.querySelector(".label");
                shadow.removeChild(old);
                
                if (newValue) {               
                    let a = document.createElement("a");
                    a.classList.add("label");
                    a.innerText = newValue;
                    a.href = newValue;
                    a.target = "_blank";
                    shadow.appendChild(a);
                }
                else {
                    let span = document.createElement("span");
                    span.classList.add("label");
                    span.innerText = "Drop a file here";
                    shadow.appendChild(span);
                }
                break;
            }
        }
    }
    
    static get observedAttributes() { return ['value']; }
}

customElements.define('upload-field', UploadField);