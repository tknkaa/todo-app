import { useState } from "react";
type InputFormProps = {
  taskList: { id: number; text: string; completed: boolean }[];
  setTaskList: (
    taskList: { id: number; text: string; completed: boolean }[],
  ) => void;
};

function InputForm(props: InputFormProps) {
  const [inputText, setInputText] = useState("");

  return (
    <div className="inputForm">
      <form
        onSubmit={(e) => {
          e.preventDefault(); //再レンダリングしない
          props.setTaskList([
            ...props.taskList,
            {
              id: props.taskList.length, //順番を入れ替えないからこれでよい
              text: inputText,
              completed: false,
            },
          ]);
          //console.log(props.taskList);
          setInputText("");
        }}
      >
        <input
          type="text"
          onChange={(e) => {
            setInputText(e.target.value);
          }}
          value={inputText}
        />
        <button>add</button>
      </form>
    </div>
  );
}

export default InputForm;
