import Title from "./components/Title";
import InputForm from "./components/InputForm";
import TodoList from "./components/TodoList";
import "./App.css";
import { useState } from "react";

const App = () => {
  const [taskList, setTaskList] = useState([]);

  return (
    <div>
      <Title />
      <InputForm taskList={taskList} setTaskList={setTaskList} />
      <TodoList taskList={taskList} setTaskList={setTaskList} />
    </div>
  );
};

export default App;
