---
title: 'OSDI_23'
date: 2024/5/7
permalink: /posts/2024/05/OSDI_23/TCLocks/
excerpt: 'OSDI_23 TCLocks'
tags:
  - OSDI
---
# Ship your Critical Section, Not Your Data: Enabling Transparent Delegation with TCLocks

Introduce the idea of **transparent** delegation, which enables developers to utilize delegation- style locking **without rewriting the application**. 

First, a thread’s stack and CPU registers contain the state of the waiter’s thread.  
Second, using the lock/unlock API pushes the thread’s context on its stack. Thus, a waiter saves its critical section context using CPU registers and stack pointer, and calling the lock API as a function.   
Finally, the combiner executes the waiter’s critical section on its behalf by assuming the role of the waiter using a lightweight context switch mechanism. This context-switch mechanism is transparent to the application.

address the data-race issue using a per-thread ephemeral stack that a waiter switches to between the acquire and release phases.

handle OOO unlocking by keeping track of the order of acquired locks. We delay the release of OOO unlocked locks until the order is the in- verse of acquired locks.

In summary, this paper makes the following contributions:   
* Design technique. We introduce a new design tech- nique called transparent delegation. Locks with this
technique allow developers to use the same APIs as traditional locks while benefiting from the scalability improvements provided by delegation-style locking.
* Delegation-based lock family. We implement TCLocks that employ transparent delegation. We first design a spinning lock and extend it to blocking and readers-writer locks, utilizing per-thread ephemeral stacks to manage the parking of waiters.
* Practical application. TCLocks incorporate various lock use scenarios, including nested locking and out- of-order unlocking. This approach allows us to realize the potential of delegation-style locking for the Linux kernel without modifying any code.

Delegation-style Locks has a **critical limitation**. It does **not** provide the same lock/unlock APIs as traditional locks [47, 67]. Consequently, we need to modify applications, which involves identifying each critical section in the code, wrapping it as a function, and modularizing the application logic for delegation. 

## TCLock Design
### Transparent delegation  透明委托
1. A thread’s execution context is well-defined by hard- ware, with thread-specific CPU registers and the stack containing all information for executing the critical section.  
2. A waiter busy-waits without modifying its state once it sends its request to the combiner. It exits only after receiving the response from the combiner.  
3. Calling the lock API as a function1 ensures that hard- ware pushes the next instruction onto the stack, making the critical section’s start address available to the com- biner for executing the critical section.  

Using these insights, the combiner pops the start address of a critical section from the waiter’s stack using a return instruction and executes it. After completing the critical section, calling the unlock API pushes the first instruction of the non-critical section onto the waiter’s stack. The waiter resumes executing the non-critical section after receiving a notification from the combiner. Thus, transparent delegation allows waiters to seamlessly pass context and resume after the critical section’s execution.

### Avoiding concurrent stack access with an ephemeral stack 使用临时堆栈来避免并发堆栈访问

Each waiter switches to its ephemeral stack during lock acquisition, and delegates its critical section to the combiner. 

By incorporating the ephemeral stack, TCLocks maintain the single-writer principle, thereby preventing concurrent access and the corruption of waiters’ stack.

### TCLock_SP 使用自旋锁实现
### TCLock_B 使用阻塞锁实现
To enable efficient parking and wakeup, we add two new states to the request field of the qnode: PARKED, in which a waiter is scheduled out, and PRCSING, which indicates that the combiner has started executing a waiter’s critical section.  
 |似乎是类似条件变量的实现
### TCLock_RW 读者写者版本
TCLock_RW is a combining-aware readers-writer lock that allows readers to execute in parallel, while writers are combined.  多读者 单写者