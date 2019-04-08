const isSupported = false//'options' in document.createElement('datalist')

class SelectOtherField extends HTMLElement {
    constructor() {
        super();

        let shadow = this.attachShadow({mode: 'open'});

        let style = document.createElement('style');

        if (isSupported) {
            style.textContent = `:host { display: inline-block;} input { width: 99%; } `;
            shadow.appendChild(style);

            let input = document.createElement("input")
            input.setAttribute("list", "datalist")
            let datalist = document.createElement("datalist")
            datalist.id = "datalist"
            shadow.appendChild(input)
            shadow.appendChild(datalist)

            input.addEventListener("change", e=>{
                var event = new Event('change')
                this.dispatchEvent(event)
            })
        }
        else {
            style.textContent = `span { display: flex; flex-wrap: wrap; justify-content: space-between } select, input { width: 48%; } `;
            shadow.appendChild(style);

            let span = document.createElement("span");
            let select = document.createElement("select");
            span.appendChild(select);
            let input = document.createElement("input");
            span.appendChild(input);
            shadow.appendChild(span);

            input.disabled = select.value !== "other";
            select.addEventListener("change", e=>{
                let options = select.options;
                let lastOption = options[options.length-1];
                let lastLabel = lastOption.label;
                input.disabled = select.value !== lastLabel;
                if (select.value !== lastLabel) {
                    input.value = "";
                }
                var event = new Event('change');
                this.dispatchEvent(event);
            });
        }
    }

    get value() {
        let shadow = this.shadowRoot;
        let select = shadow.querySelector("select");
        if (select) {
            let options = select.options;

            if (!options.length) {
                return "";
            }
            else {
                let lastOption = options[options.length-1];
                let lastLabel = lastOption.label;
                let option = select.value;
                if (option !== lastLabel) {
                    return option;
                }
                else {
                    let input = shadow.querySelector("input");
                    return input.value;
                }
            }
        }
        else {
            let input = shadow.querySelector("input")
            return input.value
        }
    }

    set value(newValue) {
        let shadow = this.shadowRoot;
        let select = shadow.querySelector("select");
        if (select) {
            let options = select.options;

            if (!options.length) {
                this.pendingValue = newValue;
            }
            else {
                let lastOption = options[options.length-1];
                let lastLabel = lastOption.label;
                let input = shadow.querySelector("input");
                let labels = [...select.options].map(option=>option.label);
                if (labels.includes(newValue)) {
                    select.value = newValue;
                    input.value = "";
                    input.disabled = true;
                }
                else {
                    console.log(`lastLabel ${lastLabel}`);
                    select.value = lastLabel;
                    input.value = newValue;
                    input.disabled = false;
                }
            }
        }
        else {
            let input = shadow.querySelector("input")
            input.value = newValue
        }
    }

    set disabled(value) {
        if (value) {
            this.setAttribute("disabled", "")
        }
        else {
            this.removeAttribute("disabled")
        }
    }

    get disabled() {
        return this.hasAttribute("disabled")
    }

    setOptions(values, labels) {
        let shadow = this.shadowRoot;
        let select = shadow.querySelector("select") || shadow.querySelector("datalist");
        select.innerHTML = "";
        values.forEach((value, i)=>{
            let label = labels[i];
            let option = document.createElement("option");
            option.value = value;
            option.text = label;
            select.appendChild(option);
        });
    }
    
    connectedCallback() {
        let shadow = this.shadowRoot;
        let select = shadow.querySelector("select") || shadow.querySelector("datalist");
        let outerOptions = this.querySelectorAll("option");
        [...outerOptions].forEach(o=>{
            let option = o.cloneNode(true);
            select.appendChild(option);
        });
        if (this.pendingValue) {
            this.value = this.pendingValue;
            delete this.pendingValue;
        }
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        switch (attrName) {
            case "disabled":
                let shadow = this.shadowRoot
                let select = shadow.querySelector("select")
                let input = shadow.querySelector("input")
                if (select) {
                    select.disabled = this.disabled
                    input.disabled = this.disabled
                }
                else {
                    input.disabled = this.disabled
                }
                
                break
        }
    }
    
    static get observedAttributes() { return ["disabled"] }
}

customElements.define('select-other-field', SelectOtherField)