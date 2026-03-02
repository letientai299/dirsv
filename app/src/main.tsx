import { render } from "preact"
import { App } from "./app"
import { applyTheme, getTheme } from "./lib/theme"
import "./style.css"

applyTheme(getTheme())

const root = document.getElementById("app")
if (root) render(<App />, root)
