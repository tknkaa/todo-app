import React from 'react'
import Title from "./components/Title";
import InputForm from "./components/InputForm";
import TodoList from './components/TodoList';
import "./App.css"

const App = () => {
  return (
    <div>
      <Title />
      <InputForm />
      <TodoList />
    </div>
  )
}

export default App
