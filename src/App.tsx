import Title from "./components/Title";
import InputForm from "./components/InputForm";
import TodoList from "./components/TodoList";
import "./App.css";
import { useState } from "react";

type Task = {
  id: number;
  text: string;
  completed: boolean;
};

function App() {
  const [taskList, setTaskList] = useState<Task[]>([]);

  return (
    <div>
      <Title />
      <InputForm taskList={taskList} setTaskList={setTaskList} />
      <TodoList taskList={taskList} setTaskList={setTaskList} />
    </div>
  );
}

export default App;
