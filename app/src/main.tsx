import { render } from "preact"
import { App } from "./app"
import { getEffectiveTheme } from "./lib/theme"
import "./style.css"

document.documentElement.setAttribute("data-theme", getEffectiveTheme())

const root = document.getElementById("app")
if (root) render(<App />, root)
