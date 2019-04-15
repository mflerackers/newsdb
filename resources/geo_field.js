class GeoField extends HTMLElement {
    constructor() {
        super();

        let shadow = this.attachShadow({mode: 'open'});

        let style = document.createElement('style');

        style.textContent = `
        ul {
            list-style-type: none;
            padding: 0;
            margins: 0;
        }
        ul li {
            padding: 5px;
            display: flex;
            flex-wrap: wrap;
            align-items: flex-start;
        }
        label {
            flex: 1 0 100px;
            max-width: 140px;
            margin-right: 10px;
            text-align: right;
        }
        label + * {
            flex: 1 0 220px;
            --max-width: 400px;
        }`;
        shadow.appendChild(style);

        let ul = document.createElement("ul");

        let li = document.createElement("li");
        let label = document.createElement("label");
        label.innerText = "Country"
        li.appendChild(label);
        let country = document.createElement("select");
        country.classList.add("country");
        countryList.forEach(countryName=>{
            let option = document.createElement("option");
            option.value = countryName.toLowerCase();
            option.text = countryName;
            country.appendChild(option);
        });
        country.value = "thailand";
        li.appendChild(country);
        ul.appendChild(li);

        li = document.createElement("li");
        label = document.createElement("label");
        label.innerText = "Province"
        li.appendChild(label);
        let province = document.createElement("select");
        province.classList.add("province");
        province.innerHTML = "<option></option>";
        Object.keys(thaiProvinceDistrict).forEach(provinceName=>{
            let option = document.createElement("option");
            option.value = provinceName.toLowerCase();
            option.text = provinceName;
            province.appendChild(option);
        });
        province.value = "bangkok";
        li.appendChild(province);
        ul.appendChild(li);

        li = document.createElement("li");
        label = document.createElement("label");
        label.innerText = "District"
        li.appendChild(label);
        let district = document.createElement("select");
        district.classList.add("district");
        district.innerHTML = "<option></option>";
        thaiProvinceDistrict["Bangkok"].forEach(districtName=>{
            let option = document.createElement("option");
            option.value = districtName.toLowerCase();
            option.text = districtName;
            district.appendChild(option);
        });
        li.appendChild(district);
        ul.appendChild(li);

        li = document.createElement("li");
        label = document.createElement("label");
        label.innerText = "City"
        li.appendChild(label);
        let city = document.createElement("input");
        city.classList.add("city");
        li.appendChild(city);
        ul.appendChild(li);

        shadow.appendChild(ul);

        country.addEventListener("change", e=>{
            province.disabled = country.value !== "thailand";
            district.disabled = country.value !== "thailand";
            city.disabled = country.value === "thailand";
            if (province.disabled) province.value="";
            if (district.disabled) district.value="";
            if (city.disabled) city.value="";
        });

        province.addEventListener("change", e=>{
            let provinceLower = province.value;
            let provinceUpper = Object.keys(thaiProvinceDistrict).find((key)=>key.toLowerCase()===provinceLower);
            let districtLabels = thaiProvinceDistrict[provinceUpper];
            district.innerHTML = "<option></option>";
            districtLabels.forEach(districtLabel=>{
                let option = document.createElement("option");
                option.value = districtLabel.toLowerCase();
                option.text = districtLabel;
                district.appendChild(option);
            });
        });
    }

    get country() {
        let shadow = this.shadowRoot;
        let country = shadow.querySelector(".country");
        return country.value;
    }

    set country(newValue) {
        console.log(`newValue ${newValue}`);
        let shadow = this.shadowRoot;
        let country = shadow.querySelector(".country");
        country.value = newValue || "";
        country.dispatchEvent(new Event("change"));
    }

    get province() {
        let shadow = this.shadowRoot;
        let province = shadow.querySelector(".province");
        return province.value || "";
    }

    set province(newValue) {
        let shadow = this.shadowRoot;
        let province = shadow.querySelector(".province");
        province.value = newValue || "";
    }

    get district() {
        let shadow = this.shadowRoot;
        let district = shadow.querySelector(".district");
        return district.value || "";
    }

    set district(newValue) {
        let shadow = this.shadowRoot;
        let district = shadow.querySelector(".district");
        district.value = newValue || "";
    }

    get city() {
        let shadow = this.shadowRoot;
        let city = shadow.querySelector(".city");
        return city.value || "";
    }

    set city(newValue) {
        let shadow = this.shadowRoot;
        let city = shadow.querySelector(".city");
        city.value = newValue || "";
    }

    get value() {
        return [this.country, this.province, this.district, this.city].join(",");
    }

    set value(newValue) {
        [this.country, this.province, this.district, this.city] = newValue.split(",");
    }
    
    connectedCallback() {
        
    }
}

customElements.define('geo-field', GeoField);