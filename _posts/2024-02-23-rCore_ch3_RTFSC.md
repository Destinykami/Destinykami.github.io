---
title: '操作系统 rCore Ch3 RTFSC'
date: 2024/02/23
permalink: /posts/2024/01/rCore-ch3-codes
excerpt: '操作系统 rCore Ch3 RTFSC'
tags:
  - OS
---
本章实现了多道程序的放置加载。

## os/src/config.rs

用于存放OS内核用到的一些常量。

```rust
//! Constants in the kernel
#[allow(unused)]
/// user app's stack size
pub const USER_STACK_SIZE: usize = 4096;
/// kernel stack size
pub const KERNEL_STACK_SIZE: usize = 4096 * 2;
/// kernel heap size
pub const KERNEL_HEAP_SIZE: usize = 0x20000;
/// the max number of apps
pub const MAX_APP_NUM: usize = 16;
/// base_addr(changed) of app
pub const APP_BASE_ADDRESS: usize = 0x80400000;
/// size limit of app
pub const APP_SIZE_LIMIT: usize = 0x20000;

/// the max number of syscall
pub const MAX_SYSCALL_NUM: usize = 500;
/// clock frequency
pub const CLOCK_FREQ: usize = 12500000;
/// the physical memory end
pub const MEMORY_END: usize = 0x88000000;
```

## os/src/console.rs

RustSBI的驱动程序，目前实现了print和println两个宏，向标准输出Stdout输出字符。

```rust
//! SBI console driver, for text output
use crate::sbi::console_putchar;
use core::fmt::{self, Write};

struct Stdout;

impl Write for Stdout {
    fn write_str(&mut self, s: &str) -> fmt::Result {
        for c in s.chars() {
            console_putchar(c as usize);
        }
        Ok(())
    }
}

pub fn print(args: fmt::Arguments) {
    Stdout.write_fmt(args).unwrap();
}

/// Print! to the host console using the format string and arguments.
#[macro_export]
macro_rules! print {
    ($fmt: literal $(, $($arg: tt)+)?) => {
        $crate::console::print(format_args!($fmt $(, $($arg)+)?))
    }
}

/// Println! to the host console using the format string and arguments.
#[macro_export]
macro_rules! println {
    ($fmt: literal $(, $($arg: tt)+)?) => {
        $crate::console::print(format_args!(concat!($fmt, "\n") $(, $($arg)+)?))
    }
}

```

## os/src/entry.asm

一段汇编代码，定义了两个section，首先是内核入口，其次是系统，大小为4096*16，并指明了栈顶的位置。

（不知道理解有没有错误）

```nasm
    .section .text.entry
    .globl _start
_start:
    la sp, boot_stack_top
    call rust_main

    .section .bss.stack
    .globl boot_stack_lower_bound
boot_stack_lower_bound:
    .space 4096 * 16
    .globl boot_stack_top
boot_stack_top:
```

## os/src/heap_alloc.rs

看名称是堆分配函数，但是Tutorial中没有提到这个呢，先搁置着吧

## os/src/lang_item.rs

目前用于输出panic信息。

```rust
//! The panic handler
use crate::sbi::shutdown;
use core::panic::PanicInfo;

#[panic_handler]
/// panic handler
fn panic(info: &PanicInfo) -> ! {
    if let Some(location) = info.location() {
        println!(
            "[kernel] Panicked at {}:{} {}",
            location.file(),
            location.line(),
            info.message().unwrap()
        );
    } else {
        println!("[kernel] Panicked: {}", info.message().unwrap());
    }
    shutdown()
}

```

## os/src/link_app.S

由os/build.rs自动生成的汇编代码，用于安放各个app在数据区的位置。

<aside>
❓ 叫数据区准确吗？

</aside>

### os/build.rs

与内核实现没啥关系，用于加载app，生成link_app.S的汇编代码。

## os/src/linker.ld

叫做linker-qemu.ld其实更准确，OS目前在qemu上运行，在k210上运行需要用linker-k210.ld.

它分配了各个段的大小，BASE_ADDRESS指示了OS系统栈的起始地址为0x80200000。

<aside>
❓ 记得在Tutorial中提到0x80000000~0x80199999的空间的用处，印象里是Qemu保留的，但是记得不是很清楚了。

</aside>

## os/src/loader.rs

用于把app加载到内存中。开始涉及到很长的代码了。拆成多块来解释。

以下代码分配内核栈KernelStack和用户栈UserStack，大小在config中定义。

get_sp获取栈顶指针的地址。

push_context用于向系统栈中插入内容。首先获取栈顶指针，根据TrapContext的大小计算指针应该移动到的位置，修改该指针指向的位置的内容（用unsafe块包裹），返回指针的位置。

这个方法只在系统栈中存在，没有在用户栈中实现。（why)

```rust
#[repr(align(4096))] //应该是用于对齐。大小需要为4KB的倍数
#[derive(Copy, Clone)]
struct KernelStack {
    data: [u8; KERNEL_STACK_SIZE],
}

#[repr(align(4096))]
#[derive(Copy, Clone)]
struct UserStack {
    data: [u8; USER_STACK_SIZE],
}

static KERNEL_STACK: [KernelStack; MAX_APP_NUM] = [KernelStack {
    data: [0; KERNEL_STACK_SIZE],
}; MAX_APP_NUM];

static USER_STACK: [UserStack; MAX_APP_NUM] = [UserStack {
    data: [0; USER_STACK_SIZE],
}; MAX_APP_NUM];

impl KernelStack {
    fn get_sp(&self) -> usize {
        self.data.as_ptr() as usize + KERNEL_STACK_SIZE
    }
    pub fn push_context(&self, trap_cx: TrapContext) -> usize {
        let trap_cx_ptr = (self.get_sp() - core::mem::size_of::<TrapContext>()) as *mut TrapContext;
        unsafe {
            *trap_cx_ptr = trap_cx;
        }
        trap_cx_ptr as usize
    }
}

impl UserStack {
    fn get_sp(&self) -> usize {
        self.data.as_ptr() as usize + USER_STACK_SIZE
    }
}
```

以下函数用于获取app的起始地址以及app的数量。

由于目前每个app的大小是固定的，所以根据 基地址+app编号*app大小即可计算出app的起始地址。

get_num_app使用extern “C”从linker_app.S中获取_num_app

<aside>
❓ 是怎么做到的

</aside>

```rust
/// Get base address of app i.
fn get_base_i(app_id: usize) -> usize {
    APP_BASE_ADDRESS + app_id * APP_SIZE_LIMIT
}

/// Get the total number of applications.
pub fn get_num_app() -> usize {
    extern "C" {
        fn _num_app();
    }
    unsafe { (_num_app as usize as *const usize).read_volatile() }
}
```

load_app用于加载app到相应的内存地址。

实现逻辑：首先找到对应app的起始地址和结束地址，清空该地址区域的数据，然后把app数据复制到src中，使用切片的from_raw_parts方法，最后把src复制到dst中。

<aside>
❓ 还有更方便的方法吗？

</aside>

```rust
/// Load nth user app at
/// [APP_BASE_ADDRESS + n * APP_SIZE_LIMIT, APP_BASE_ADDRESS + (n+1) * APP_SIZE_LIMIT).
pub fn load_apps() {
    extern "C" {
        fn _num_app();
    }
    let num_app_ptr = _num_app as usize as *const usize;
    let num_app = get_num_app();
    let app_start = unsafe { core::slice::from_raw_parts(num_app_ptr.add(1), num_app + 1) };
    
    // load apps
    for i in 0..num_app {
        let base_i = get_base_i(i);
        // clear region
        (base_i..base_i + APP_SIZE_LIMIT)
            .for_each(|addr| unsafe { (addr as *mut u8).write_volatile(0) });
        // load app from data section to memory
        let src = unsafe {
            core::slice::from_raw_parts(app_start[i] as *const u8, app_start[i + 1] - app_start[i])
        };
        let dst = unsafe { core::slice::from_raw_parts_mut(base_i as *mut u8, src.len()) };
        dst.copy_from_slice(src);
    }
    // clear i-cache first
    //修改，在程序全部存入内存后应该清空缓存。
    unsafe {
        asm!("fence.i");
    }
}
```

这个并不是很懂呢。

```rust
/// get app info with entry and sp and save `TrapContext` in kernel stack
pub fn init_app_cx(app_id: usize) -> usize {
    KERNEL_STACK[app_id].push_context(TrapContext::app_init_context(
        get_base_i(app_id),
        USER_STACK[app_id].get_sp(),
    ))
}
```

## os/src/logging.rs

日志模块。

在编译时使用make run LOG=TRACE即可看到彩色的信息。

## os/src/sbi.rs

RustSBI的支持，涉及到比较底层的操作sbi_call。和system_call比较像。

想起了在PA中所做的systemcall，x10寄存器用于存储系统调用号，以及存储返回值ret。

```rust
//! SBI call wrappers

use core::arch::asm;

const SBI_SET_TIMER: usize = 0;
const SBI_CONSOLE_PUTCHAR: usize = 1;
const SBI_SHUTDOWN: usize = 8;

/// general sbi call
#[inline(always)]
fn sbi_call(which: usize, arg0: usize, arg1: usize, arg2: usize) -> usize {
    let mut ret;
    unsafe {
        asm!(
            "li x16, 0",
            "ecall",
            inlateout("x10") arg0 => ret,
            in("x11") arg1,
            in("x12") arg2,
            in("x17") which,
        );
    }
    ret
}

/// use sbi call to set timer
pub fn set_timer(timer: usize) {
    sbi_call(SBI_SET_TIMER, timer, 0, 0);
}

/// use sbi call to putchar in console (qemu uart handler)
pub fn console_putchar(c: usize) {
    sbi_call(SBI_CONSOLE_PUTCHAR, c, 0, 0);
}

/// use sbi call to shutdown the kernel
pub fn shutdown() -> ! {
    sbi_call(SBI_SHUTDOWN, 0, 0, 0);
    panic!("It should shutdown!");
}

```

## os/src/timer.rs

涉及到时钟的一些操作。包括获取当前时间(tick,ms,us)，以及设置时钟中断。

```rust
//! RISC-V timer-related functionality

use crate::config::CLOCK_FREQ;
use crate::sbi::set_timer;
use riscv::register::time;
/// The number of ticks per second
const TICKS_PER_SEC: usize = 100;
#[allow(dead_code)]
/// The number of milliseconds per second
const MSEC_PER_SEC: usize = 1000;
/// The number of microseconds per second
#[allow(dead_code)]
const MICRO_PER_SEC: usize = 1_000_000;

/// Get the current time in ticks
pub fn get_time() -> usize {
    time::read()
}

/// get current time in milliseconds
#[allow(dead_code)]
pub fn get_time_ms() -> usize {
    time::read() / (CLOCK_FREQ / MSEC_PER_SEC)
}

/// get current time in microseconds
#[allow(dead_code)]
pub fn get_time_us() -> usize {
    time::read() * MICRO_PER_SEC / CLOCK_FREQ
}

/// Set the next timer interrupt
pub fn set_next_trigger() {
    set_timer(get_time() + CLOCK_FREQ / TICKS_PER_SEC);
}

```

## os/src/sync

定义了UPSafeCell，允许我们在单核上安全的使用可变全局变量。

调用 exclusive_access 可以得到它包裹的数据的独占访问权。因此当我们要访问数据时（无论读还是写），需要首先调用 exclusive_access 获得数据的可变借用标记，通过它可以完成数据的读写，在操作完成之后我们需要销毁这个标记，此后才能开始对该数据的下一次访问。相比 RefCell 它不再允许多个读操作同时存在。

```rust
pub struct UPSafeCell<T> {
    /// inner data
    inner: RefCell<T>,
}

unsafe impl<T> Sync for UPSafeCell<T> {}
///允许我们在单核上安全使用可变全局变量
impl<T> UPSafeCell<T> {
    /// User is responsible to guarantee that inner struct is only used in
    /// uniprocessor.
    pub unsafe fn new(value: T) -> Self {
        Self {
            inner: RefCell::new(value),
        }
    }
    /// Exclusive access inner data in UPSafeCell. Panic if the data has been borrowed.
    pub fn exclusive_access(&self) -> RefMut<'_, T> {
        self.inner.borrow_mut()
    }
}
```

## os/src/syscall

系统调用

### os/src/syscall/fs.rs

和文件操作有关的系统调用。

目前实现sys_write

```rust
//! File and filesystem-related syscalls

const FD_STDOUT: usize = 1;

/// write buf of length `len`  to a file with `fd`
pub fn sys_write(fd: usize, buf: *const u8, len: usize) -> isize {
    trace!("kernel: sys_write");
    match fd {
        FD_STDOUT => {
            let slice = unsafe { core::slice::from_raw_parts(buf, len) };
            let str = core::str::from_utf8(slice).unwrap();
            print!("{}", str);
            len as isize
        }
        _ => {
            panic!("Unsupported fd in sys_write!");
        }
    }
}

```

### os/src/syscall/process.rs

和进程有关的系统调用

目前实现sys_exit，sys_yield , sys_get_time , sys_task_info

```rust
//! Process management syscalls
use crate::{
    config::MAX_SYSCALL_NUM,
    task::{exit_current_and_run_next, suspend_current_and_run_next, TaskStatus, get_current_task},
    timer::{get_time_us, get_time_ms},
};

#[repr(C)]
#[derive(Debug)]
pub struct TimeVal {
    pub sec: usize,
    pub usec: usize,
}

/// Task information
#[allow(dead_code)]
pub struct TaskInfo {
    /// Task status in it's life cycle
    status: TaskStatus,
    /// The numbers of syscall called by task
    syscall_times: [u32; MAX_SYSCALL_NUM],
    /// Total running time of task
    time: usize,
}

/// task exits and submit an exit code
pub fn sys_exit(exit_code: i32) -> ! {
    trace!("[kernel] Application exited with code {}", exit_code);
    exit_current_and_run_next();
    panic!("Unreachable in sys_exit!");
}

/// current task gives up resources for other tasks
pub fn sys_yield() -> isize {
    trace!("kernel: sys_yield");
    suspend_current_and_run_next();
    0
}

/// get time with second and microsecond
pub fn sys_get_time(ts: *mut TimeVal, _tz: usize) -> isize {
    trace!("kernel: sys_get_time");
    let us = get_time_us();
    unsafe {
        *ts = TimeVal {
            sec: us / 1_000_000,
            usec: us % 1_000_000,
        };
    }
    0
}

/// YOUR JOB: Finish sys_task_info to pass testcases
pub fn sys_task_info(ti: *mut TaskInfo) -> isize {
    trace!("kernel: sys_task_info");
    let tcb=get_current_task();
    unsafe {
        (*ti).time=get_time_ms()-tcb.start_time;
        (*ti).syscall_times=tcb.syscall_times;
        (*ti).status=tcb.task_status;
    }
    0
}

```

### os/src/syscall/mod.rs

处理系统调用的分发。

和PA中的操作类似。

PA:

```c
//PA中的处理
void do_syscall(Context *c) {
  uintptr_t a[4];
  a[0] = c->GPR1;
  intptr_t ret;
  switch (a[0]) {
    case SYS_yield: ret = sys_yield(); break;
    case SYS_exit: sys_exit(c->GPR2); break;
    case SYS_write:
        ret = sys_write(c->GPR2, (void *)c->GPR3, (size_t)c->GPR4);
        break;
    default: panic("Unhandled syscall ID = %d", a[0]);
  }

  c->GPRx = ret; //  gpr[10]为syscall的返回值
}
```

```rust
//! Implementation of syscalls
//!
//! The single entry point to all system calls, [`syscall()`], is called
//! whenever userspace wishes to perform a system call using the `ecall`
//! instruction. In this case, the processor raises an 'Environment call from
//! U-mode' exception, which is handled as one of the cases in
//! [`crate::trap::trap_handler`].
//!
//! For clarity, each single syscall is implemented as its own function, named
//! `sys_` then the name of the syscall. You can find functions like this in
//! submodules, and you should also implement syscalls this way.

/// write syscall
const SYSCALL_WRITE: usize = 64;
/// exit syscall
const SYSCALL_EXIT: usize = 93;
/// yield syscall
const SYSCALL_YIELD: usize = 124;
/// gettime syscall
const SYSCALL_GET_TIME: usize = 169;
/// taskinfo syscall
const SYSCALL_TASK_INFO: usize = 410;

mod fs;
mod process;

use fs::*;
use process::*;

use crate::task::inc_syscall_times;
/// handle syscall exception with `syscall_id` and other arguments
pub fn syscall(syscall_id: usize, args: [usize; 3]) -> isize {
    inc_syscall_times(syscall_id);
    match syscall_id {
        SYSCALL_WRITE => sys_write(args[0], args[1] as *const u8, args[2]),
        SYSCALL_EXIT => sys_exit(args[0] as i32),
        SYSCALL_YIELD => sys_yield(),
        SYSCALL_GET_TIME => sys_get_time(args[0] as *mut TimeVal, args[1]),
        SYSCALL_TASK_INFO => sys_task_info(args[0] as *mut TaskInfo),
        _ => panic!("Unsupported syscall_id: {}", syscall_id),
    }
}

```

## os/src/task

管理任务

### os/src/task.rs

管理当前的任务。

TCB（TaskControlBlock）进程控制块

```rust
use crate::config::MAX_SYSCALL_NUM;

use super::TaskContext;

/// The task control block (TCB) of a task.
#[derive(Copy, Clone)]
pub struct TaskControlBlock {
    /// The task status in it's lifecycle
    pub task_status: TaskStatus,
    /// The task context
    pub task_cx: TaskContext,
    /// 系统调用次数
    pub syscall_times:[u32;MAX_SYSCALL_NUM],
    /// 任务开始时间
    pub start_time:usize,
}

/// The status of a task
#[derive(Copy, Clone, PartialEq)]
pub enum TaskStatus {
    /// uninitialized
    UnInit,
    /// ready to run
    Ready,
    /// running
    Running,
    /// exited
    Exited,
}
```

### os/src/task/switch.rs

切换到下一个任务，调用汇编代码switch.S实现。

### os/src/task/switch.S

汇编代码，实现上大概是保存当前寄存器，恢复寄存器。 以及存储栈指针，恢复栈指针。

### os/src/task/context.rs

维护任务上下文（TaskContext），其实就是维护寄存器。

```rust
pub struct TaskContext {
    /// Ret position after task switching
    ra: usize,
    /// Stack pointer
    sp: usize,
    /// s0-11 register, callee saved
    s: [usize; 12],
}
```

为任务上下文实现了zero_init和goto_restore两个方法，用于创建空任务，保存当前任务状态。

```rust
impl TaskContext {
    /// Create a new empty task context
    pub fn zero_init() -> Self {
        Self {
            ra: 0,
            sp: 0,
            s: [0; 12],
        }
    }
    /// Create a new task context with a trap return addr and a kernel stack pointer
    pub fn goto_restore(kstack_ptr: usize) -> Self {
        extern "C" {
            fn __restore();  //在trap.S中实现
        }
        Self {
            ra: __restore as usize,
            sp: kstack_ptr,
            s: [0; 12],
        }
    }
}
```

### os/src/task/mod.rs

实现了任务管理器。

inner使用UPSafeCell包裹，实现了全局变量的可变引用。

```rust
pub struct TaskManager {
    /// total number of tasks
    num_app: usize,
    /// use inner value to get mutable access
    inner: UPSafeCell<TaskManagerInner>,
}

/// Inner of Task Manager
pub struct TaskManagerInner {
    /// task list
    tasks: [TaskControlBlock; MAX_APP_NUM],
    /// id of current `Running` task
    current_task: usize,
}
```

初始化使用lazy_static包裹，在用到它的时候才进行初始化。

```rust
lazy_static! {
    /// Global variable: TASK_MANAGER
    pub static ref TASK_MANAGER: TaskManager = {
        let num_app = get_num_app();
        let mut tasks = [TaskControlBlock {
            task_cx: TaskContext::zero_init(),
            task_status: TaskStatus::UnInit,
            syscall_times:[0;MAX_SYSCALL_NUM],
            start_time:0,
        }; MAX_APP_NUM];
        for (i, task) in tasks.iter_mut().enumerate() {
            task.task_cx = TaskContext::goto_restore(init_app_cx(i));
            task.task_status = TaskStatus::Ready;
        }
        TaskManager {
            num_app,
            inner: unsafe {
                UPSafeCell::new(TaskManagerInner {
                    tasks,
                    current_task: 0,
                })
            },
        }
    };
}
```

以下为任务管理实现了几个方法。

run_first_task：运行第一个任务

mark_current_suspended：把当前正在运行的任务的状态设为就绪态

mark_current_exited：把当前正在运行的任务的状态设为退出态

find_next_task：查找下一个任务id，目前只查找就绪态的任务

run_next_task：运行下一个任务

以下两个是自己实现的：

get_current_task：获取当前任务的TCB

inc_syscall_times：增加当前任务的系统调用统计次数

```rust
impl TaskManager {
    /// Run the first task in task list.
    ///
    /// Generally, the first task in task list is an idle task (we call it zero process later).
    /// But in ch3, we load apps statically, so the first task is a real app.
    fn run_first_task(&self) -> ! {
        let mut inner = self.inner.exclusive_access();
        let task0 = &mut inner.tasks[0];
        task0.task_status = TaskStatus::Running;
        let next_task_cx_ptr = &task0.task_cx as *const TaskContext;
        drop(inner);
        let mut _unused = TaskContext::zero_init();
        // before this, we should drop local variables that must be dropped manually
        unsafe {
            __switch(&mut _unused as *mut TaskContext, next_task_cx_ptr);
        }
        panic!("unreachable in run_first_task!");
    }

    /// Change the status of current `Running` task into `Ready`.
    fn mark_current_suspended(&self) {
        let mut inner = self.inner.exclusive_access();
        let current = inner.current_task;
        inner.tasks[current].task_status = TaskStatus::Ready;
    }

    /// Change the status of current `Running` task into `Exited`.
    fn mark_current_exited(&self) {
        let mut inner = self.inner.exclusive_access();
        let current = inner.current_task;
        inner.tasks[current].task_status = TaskStatus::Exited;
    }

    /// Find next task to run and return task id.
    ///
    /// In this case, we only return the first `Ready` task in task list.
    fn find_next_task(&self) -> Option<usize> {
        let inner = self.inner.exclusive_access();
        let current = inner.current_task;
        (current + 1..current + self.num_app + 1)
            .map(|id| id % self.num_app)
            .find(|id| inner.tasks[*id].task_status == TaskStatus::Ready)
    }

    /// Switch current `Running` task to the task we have found,
    /// or there is no `Ready` task and we can exit with all applications completed
    fn run_next_task(&self) {
        if let Some(next) = self.find_next_task() {
            let mut inner = self.inner.exclusive_access();
            let current = inner.current_task;
            inner.tasks[next].task_status = TaskStatus::Running;
            inner.current_task = next;
            let current_task_cx_ptr = &mut inner.tasks[current].task_cx as *mut TaskContext;
            let next_task_cx_ptr = &inner.tasks[next].task_cx as *const TaskContext;
            drop(inner);
            // before this, we should drop local variables that must be dropped manually
            unsafe {
                __switch(current_task_cx_ptr, next_task_cx_ptr);
            }
            // go back to user mode
        } else {
            panic!("All applications completed!");
        }
    }
    ///当前任务的TCB
    fn get_current_task(&self)->TaskControlBlock{
        let inner=self.inner.exclusive_access();
        let current=inner.current_task;
        inner.tasks[current]
    }
    ///增加系统调用次数
    fn inc_syscall_times(&self,syscall_id:usize){
        let mut inner=self.inner.exclusive_access();
        let current=inner.current_task;
        inner.tasks[current].syscall_times[syscall_id]+=1;
    }
}
```

有了这些实现，加上一层抽象就可以变成对外的接口了：

```rust
/// Run the first task in task list.
pub fn run_first_task() {
    TASK_MANAGER.run_first_task();
}

/// Switch current `Running` task to the task we have found,
/// or there is no `Ready` task and we can exit with all applications completed
fn run_next_task() {
    TASK_MANAGER.run_next_task();
}

/// Change the status of current `Running` task into `Ready`.
fn mark_current_suspended() {
    TASK_MANAGER.mark_current_suspended();
}

/// Change the status of current `Running` task into `Exited`.
fn mark_current_exited() {
    TASK_MANAGER.mark_current_exited();
}

/// Suspend the current 'Running' task and run the next task in task list.
pub fn suspend_current_and_run_next() {
    mark_current_suspended();
    run_next_task();
}

/// Exit the current 'Running' task and run the next task in task list.
pub fn exit_current_and_run_next() {
    mark_current_exited();
    run_next_task();
}
///get tcb
pub fn get_current_task()->TaskControlBlock{
    TASK_MANAGER.get_current_task()
}
///inc 
pub fn inc_syscall_times(syscall_id:usize){
    TASK_MANAGER.inc_syscall_times(syscall_id);
}
```

## os/src/trap

处理陷入指令

### os/src/trap/context.rs

app在调用高特权级的指令时就会进入自陷状态，需要保存陷入的上下文。

<aside>
❓ 应该看看Tutorial好好再理解一下..

</aside>

```rust
pub struct TrapContext {
    /// General-Purpose Register x0-31
    pub x: [usize; 32],
    /// Supervisor Status Register
    pub sstatus: Sstatus,
    /// Supervisor Exception Program Counter
    pub sepc: usize,
}

impl TrapContext {
    /// put the sp(stack pointer) into x\[2\] field of TrapContext
    pub fn set_sp(&mut self, sp: usize) {
        self.x[2] = sp;
    }
    /// init the trap context of an application
    pub fn app_init_context(entry: usize, sp: usize) -> Self {
        let mut sstatus = sstatus::read(); // CSR sstatus
        sstatus.set_spp(SPP::User); //previous privilege mode: user mode
        let mut cx = Self {
            x: [0; 32],
            sstatus,
            sepc: entry, // entry point of app
        };
        cx.set_sp(sp); // app's user stack pointer
        cx // return initial Trap Context of app
    }
}
```

### os/src/trap/mod.rs

~~*这个在干啥..*~~

```rust
/// Initialize trap handling
pub fn init() {
    extern "C" {
        fn __alltraps();
    }
    unsafe {
        stvec::write(__alltraps as usize, TrapMode::Direct);
    }
}
```

启用时钟中断

```rust
/// enable timer interrupt in supervisor mode
pub fn enable_timer_interrupt() {
    unsafe {
        sie::set_stimer();
    }
}
```

处理陷入指令

```rust
/// trap handler
#[no_mangle]
pub fn trap_handler(cx: &mut TrapContext) -> &mut TrapContext {
    let scause = scause::read(); // get trap cause
    let stval = stval::read(); // get extra value
                               // trace!("into {:?}", scause.cause());
    match scause.cause() {
        Trap::Exception(Exception::UserEnvCall) => {
            // jump to next instruction anyway
            cx.sepc += 4;
            // get system call return value
            cx.x[10] = syscall(cx.x[17], [cx.x[10], cx.x[11], cx.x[12]]) as usize;
        }
        Trap::Exception(Exception::StoreFault) | Trap::Exception(Exception::StorePageFault) => {
            println!("[kernel] PageFault in application, bad addr = {:#x}, bad instruction = {:#x}, kernel killed it.", stval, cx.sepc);
            exit_current_and_run_next();
        }
        Trap::Exception(Exception::IllegalInstruction) => {
            println!("[kernel] IllegalInstruction in application, kernel killed it.");
            exit_current_and_run_next();
        }
        Trap::Interrupt(Interrupt::SupervisorTimer) => {
            set_next_trigger();
            suspend_current_and_run_next();
        }
        _ => {
            panic!(
                "Unsupported trap {:?}, stval = {:#x}!",
                scause.cause(),
                stval
            );
        }
    }
    cx
}
```

### os/src/trap/trap.S

应该是很精彩的一段汇编代码，只是我还看不懂。