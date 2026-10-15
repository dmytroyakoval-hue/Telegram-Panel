import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import ru from 'element-plus/es/locale/lang/ru'
import '@fontsource/roboto/latin-300.css'
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'
import '@material-design-icons/font/filled.css'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/global.css'
import App from './App.vue'
import router from './router'
import { isBenignRuntimeError } from './utils/runtimeErrors'
import { installRussianRuntimeLocalization } from './utils/runtimeRussian'

const app = createApp(App)

app.config.errorHandler = (error) => {
  if (isBenignRuntimeError(error)) return
  window.dispatchEvent(new CustomEvent('telegram-panel:error', { detail: error }))
  console.error(error)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: ru })
app.mount('#app')
installRussianRuntimeLocalization()
