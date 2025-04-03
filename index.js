import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js"
import { getDatabase,
        ref,
        push,
       onValue,
       remove} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-database.js"


const firebaseConfig = {
    databaseURL:"https://leads-tracker-app-1fb76-default-rtdb.europe-west1.firebasedatabase.app/"
}
const app = initializeApp(firebaseConfig)
const database = getDatabase(app)
console.log(firebaseConfig.databaseURL)
const referenceInDB = ref(database,"leads")
const inputEl = document.getElementById("input-el")
const inputBtn = document.getElementById("input-btn")
const ulEl = document.getElementById("ul-el")
const deleteEL= document.getElementById("delete")


function render(leads) {
    let listItems = ""
    for (let i = 0; i < leads.length; i++) {
        listItems += `
            <li>
                <a target='_blank' href='${leads[i]}'>
                    ${leads[i]}
                </a>
            </li>
        `
    }
    ulEl.innerHTML = listItems  
}
 
onValue(referenceInDB, function(snapshot){
    if(snapshot.exists()) {
        const snapshotValues = snapshot.val()
        const leads = Object.values(snapshotValues)
        render(leads)
    }
})

inputBtn.addEventListener("click", function() {
     push(referenceInDB, inputEl.value)
    inputEl.value = ""
})

deleteEL.addEventListener("dblclick", function() {
     remove(referenceInDB)
     ulEl.innerHTML = ""
})


