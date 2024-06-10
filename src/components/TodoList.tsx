type TodoListProps = {
  taskList: { id: number; text: string; completed: boolean }[];
  setTaskList: (
    taskList: { id: number; text: string; completed: boolean }[],
  ) => void;
};

function TodoList(props: TodoListProps) {
  return (
    <div className="todoList">
      <div className="todos">
        {props.taskList.map((task, index) => (
          <div
            className={`todo ${task.completed ? "completed" : ""}`}
            key={index}
          >
            <div className="todoText">
              <span>{task.text}</span>
            </div>
            <div className="icons">
              <button
                onClick={() => {
                  props.setTaskList(
                    props.taskList.map((previousTask) => {
                      if (previousTask.id === task.id) {
                        return {
                          ...previousTask,
                          completed: !previousTask.completed,
                        };
                      } else {
                        return previousTask;
                      }
                    }),
                  );
                }}
              >
                check
              </button>
              <button
                onClick={() => {
                  props.setTaskList(
                    props.taskList.filter(
                      (previousTask) => previousTask.id !== task.id,
                    ),
                  );
                }}
              >
                delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TodoList;
