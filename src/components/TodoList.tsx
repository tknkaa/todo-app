import React from 'react'

const TodoList = () => {
  return (
    <div className='todoList'>
      <div className='todos'>
        <div className='todo'>
          <div className='todoTexxt'>
            <span>sleep</span>
          </div>
          <div className='icons'>
            <button>
              check
            </button>
            <button>
              delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TodoList
