import { render } from "preact"
import { App } from "./app"
import { warmUpShiki } from "./lib/markdown"
import { getEffectiveTheme } from "./lib/theme"
import "./style.css"

document.documentElement.setAttribute("data-theme", getEffectiveTheme())
warmUpShiki()

const root = document.getElementById("app")
if (root) render(<App />, root)
