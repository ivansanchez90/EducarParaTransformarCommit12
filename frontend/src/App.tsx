import { BrowserRouter, Routes, Route } from 'react-router-dom'

import Home from './Home'
import Login from './Login'
import AdminPanel from './AdminPanel'
import StudentPortal from './StudentPortal'
import NoticiaDetalle from './NoticiaDetalle'
import { ActualizarApp } from './pwa/ActualizarApp'
import { AvisoSinConexion } from './pwa/AvisoSinConexion'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/noticias/:id' element={<NoticiaDetalle />} />
        <Route path='/login' element={<Login />} />
        <Route path='/admin' element={<AdminPanel />} />
        <Route path='/portal' element={<StudentPortal />} />
      </Routes>
      <ActualizarApp />
      <AvisoSinConexion />
    </BrowserRouter>
  )
}

export default App
