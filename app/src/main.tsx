import { render } from "preact"
import { App } from "./app"
import { warmUpShiki } from "./lib/markdown"
import { applyTheme, getTheme } from "./lib/theme"
import "./style.css"

applyTheme(getTheme())
warmUpShiki()

const root = document.getElementById("app")
if (root) render(<App />, root)
