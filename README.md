# seat_booking_system
🚀 Office Seat Booking System

A full-stack web application that enables employees to book office seats efficiently in a hybrid work environment with intelligent scheduling, booking limits, and seat management.

📌 Features
🔐 Authentication
User Signup & Login
🪑 Seat Booking
50 total seats
Real-time booking system
Prevents double booking
🔄 Hybrid Work Scheduling
Batch-based office attendance system
Week-wise scheduling logic
🟦 Floating Seats
10 seats available for all users
📅 Date-based Booking
Users can book seats for specific days
❌ Leave Management
Users can mark leave
Automatically releases booked seat
📊 Booking Limits
Max 1 seat per day per user
Max 5 bookings per 2-week cycle
💾 Persistent Storage
Data stored in JSON file (no data loss on restart)
🧠 Business Logic
🪑 Seat Distribution
50 total seats
40 fixed seats
10 floating seats
👥 Organization Structure
10 squads
Each squad has 8 members
Each squad divided into:
Batch A
Batch B
📅 Hybrid Work Schedule

Batch A:

Week 1 → Mon, Tue, Wed
Week 2 → Thu, Fri

Batch B:

Week 1 → Thu, Fri
Week 2 → Mon, Tue, Wed
⚙️ Booking Rules
✅ One seat per user per day
✅ Maximum 5 bookings per 2-week cycle
✅ No double booking (same seat + date)
✅ Only allowed batch days
✅ Floating seats open to all
✅ Leave releases booked seat
🛠️ Tech Stack

Frontend:

HTML
CSS
JavaScript

Backend:

Node.js
Express.js

Storage:

JSON file (for persistence)
