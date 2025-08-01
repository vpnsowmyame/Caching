# main.py
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import redis.asyncio as redis
import asyncio
import time
from typing import Dict, Any

# --- Configuration ---
# Redis connection details
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_DB = 0
REDIS_TTL_SECONDS = 30 # Time-to-live for cached items

# --- Simulated Database ---
# In a real application, this would be a database like PostgreSQL, MongoDB, etc.
# We'll use a simple dictionary to simulate data storage.
# Key: item_id, Value: {name: str, description: str, value: float, timestamp: float}
simulated_db: Dict[str, Dict[str, Any]] = {}

# --- Redis Client Initialization ---
# Use redis.asyncio for asynchronous operations with FastAPI
redis_client: redis.Redis = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)

# --- FastAPI Application Setup ---
app = FastAPI(
    title="FastAPI Caching Patterns Demo",
    description="Demonstrates various server-side caching strategies.",
    version="1.0.0"
)

# --- Pydantic Models ---
class Item(BaseModel):
    name: str
    description: str
    value: float

class ItemInDB(Item):
    item_id: str
    timestamp: float

# --- Helper Functions ---

async def get_item_from_db(item_id: str) -> Dict[str, Any] | None:
    """Simulates fetching an item from the database."""
    print(f"--- DB READ: Fetching item_id: {item_id} from simulated_db ---")
    await asyncio.sleep(0.5) # Simulate network/DB latency
    return simulated_db.get(item_id)

async def write_item_to_db(item_id: str, item_data: Dict[str, Any]):
    """Simulates writing an item to the database."""
    print(f"--- DB WRITE: Writing item_id: {item_id} to simulated_db ---")
    await asyncio.sleep(1) # Simulate network/DB write latency
    simulated_db[item_id] = item_data
    print(f"--- DB WRITE: Item {item_id} written to DB ---")

async def delete_item_from_db(item_id: str):
    """Simulates deleting an item from the database."""
    print(f"--- DB DELETE: Deleting item_id: {item_id} from simulated_db ---")
    await asyncio.sleep(0.5) # Simulate network/DB latency
    if item_id in simulated_db:
        del simulated_db[item_id]
        print(f"--- DB DELETE: Item {item_id} deleted from DB ---")
    else:
        print(f"--- DB DELETE: Item {item_id} not found in DB ---")

# --- Caching Pattern Implementations ---

@app.post("/write-through/{item_id}", response_model=ItemInDB, summary="Write-Through Caching")
async def create_item_write_through(item_id: str, item: Item):
    """
    **Write-Through Caching:**
    Data is written to both the cache and the underlying persistent data store simultaneously.
    Ensures strong data consistency, as the cache is always up-to-date.
    Introduces write latency because both operations must complete before the write is acknowledged.
    Usecases: Financial transactions, user authentication data.
    """
    item_data = item.model_dump()
    item_data["item_id"] = item_id
    item_data["timestamp"] = time.time()

    # 1. Write to Database
    await write_item_to_db(item_id, item_data)

    # 2. Write to Cache (simultaneously or immediately after DB write)
    # Store as a JSON string in Redis
    await redis_client.setex(f"item:{item_id}", REDIS_TTL_SECONDS, ItemInDB(**item_data).model_dump_json())
    print(f"--- CACHE WRITE: Item {item_id} written to cache (Write-Through) ---")

    return ItemInDB(**item_data)

@app.post("/write-behind/{item_id}", response_model=ItemInDB, summary="Write-Behind Caching")
async def create_item_write_behind(item_id: str, item: Item, background_tasks: BackgroundTasks):
    """
    **Write-Behind Caching:**
    Data is written to the cache first, and the write to the underlying data store is deferred and performed asynchronously.
    Reduces write latency for the client.
    Introduces a risk of data loss if the cache fails before the data is persisted to the database.
    Usecases: Social media likes/comments, logging, analytics where immediate persistence isn't critical.
    """
    item_data = item.model_dump()
    item_data["item_id"] = item_id
    item_data["timestamp"] = time.time()

    # 1. Write to Cache immediately
    await redis_client.setex(f"item:{item_id}", REDIS_TTL_SECONDS, ItemInDB(**item_data).model_dump_json())
    print(f"--- CACHE WRITE: Item {item_id} written to cache (Write-Behind) ---")

    # 2. Add background task to write to Database asynchronously
    background_tasks.add_task(write_item_to_db, item_id, item_data)
    print(f"--- DB WRITE DEFERRED: Item {item_id} will be written to DB asynchronously ---")

    return ItemInDB(**item_data)

async def read_through_get_item(item_id: str) -> ItemInDB:
    """
    **Read-Through Caching (implemented as a helper function):**
    The cache acts as the primary data source. When data is requested, the cache is checked.
    If a cache miss occurs, the cache itself is responsible for fetching the data from the underlying data store,
    populating itself, and then returning the data to the application.
    This pattern is often seen in distributed caching systems where the cache layer itself manages data retrieval from the origin.
    """
    # 1. Check cache
    cached_item = await redis_client.get(f"item:{item_id}")
    if cached_item:
        print(f"--- CACHE HIT: Item {item_id} found in cache (Read-Through) ---")
        return ItemInDB.model_validate_json(cached_item)

    print(f"--- CACHE MISS: Item {item_id} not in cache (Read-Through) ---")
    # 2. Cache miss: Fetch from database
    db_item = await get_item_from_db(item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    # 3. Populate cache
    await redis_client.setex(f"item:{item_id}", REDIS_TTL_SECONDS, ItemInDB(**db_item).model_dump_json())
    print(f"--- CACHE POPULATED: Item {item_id} added to cache (Read-Through) ---")

    return ItemInDB(**db_item)

@app.get("/read-through/{item_id}", response_model=ItemInDB, summary="Read-Through Caching")
async def get_item_read_through(item_id: str):
    return await read_through_get_item(item_id)


@app.get("/cache-aside/{item_id}", response_model=ItemInDB, summary="Cache-Aside Caching")
async def get_item_cache_aside(item_id: str):
    """
    **Cache-Aside:**
    The application directly manages the cache. When data is needed, the application first checks the cache.
    On a cache hit, data is returned. On a cache miss, the application fetches data from the primary store,
    populates the cache, and then returns the data.
    Usecases: General-purpose caching of read-heavy data (e.g., API responses, product catalogs).
    """
    # 1. Check cache first
    cached_item = await redis_client.get(f"item:{item_id}")
    if cached_item:
        print(f"--- CACHE HIT: Item {item_id} found in cache (Cache-Aside) ---")
        return ItemInDB.model_validate_json(cached_item)

    print(f"--- CACHE MISS: Item {item_id} not in cache (Cache-Aside) ---")
    # 2. If not in cache, fetch from database
    db_item = await get_item_from_db(item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    # 3. Populate cache with the fetched data
    await redis_client.setex(f"item:{item_id}", REDIS_TTL_SECONDS, ItemInDB(**db_item).model_dump_json())
    print(f"--- CACHE POPULATED: Item {item_id} added to cache (Cache-Aside) ---")

    return ItemInDB(**db_item)

@app.delete("/invalidate-cache/{item_id}", summary="Invalidate Cache for an Item")
async def invalidate_cache(item_id: str):
    """
    Invalidates an item from the cache. Useful after updates or deletions.
    """
    deleted_count = await redis_client.delete(f"item:{item_id}")
    if deleted_count > 0:
        print(f"--- CACHE INVALIDATED: Item {item_id} removed from cache ---")
        return {"message": f"Cache for item {item_id} invalidated."}
    else:
        print(f"--- CACHE INVALIDATION: Item {item_id} not found in cache ---")
        return {"message": f"Item {item_id} was not in cache."}

@app.delete("/delete-item/{item_id}", summary="Delete Item from DB and Invalidate Cache")
async def delete_item(item_id: str):
    """
    Deletes an item from the database and then invalidates it from the cache.
    This is often used with Cache-Aside or Read-Through patterns to maintain consistency.
    """
    await delete_item_from_db(item_id)
    await invalidate_cache(item_id)
    return {"message": f"Item {item_id} deleted from DB and cache invalidated."}

@app.get("/health", summary="Health Check")
async def health_check():
    """Checks if the application and Redis are accessible."""
    try:
        await redis_client.ping()
        return {"status": "ok", "redis_connected": True}
    except Exception as e:
        return {"status": "error", "redis_connected": False, "detail": str(e)}

@app.get("/simulated-db/{item_id}", summary="Directly Read from Simulated DB")
async def get_item_from_simulated_db(item_id: str):
    """Allows direct inspection of the simulated database."""
    item = await get_item_from_db(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in simulated DB")
    return ItemInDB(**item)

@app.get("/simulated-db-all", summary="Get All Items from Simulated DB")
async def get_all_items_from_simulated_db():
    """Allows direct inspection of all items in the simulated database."""
    return simulated_db

@app.on_event("startup")
async def startup_event():
    """Connect to Redis on application startup."""
    try:
        await redis_client.ping()
        print("Connected to Redis successfully!")
    except redis.ConnectionError as e:
        print(f"Could not connect to Redis: {e}. Please ensure Redis is running.")
        # In a real app, you might want to exit or handle this more gracefully.

@app.on_event("shutdown")
async def shutdown_event():
    """Close Redis connection on application shutdown."""
    await redis_client.close()
    print("Redis connection closed.")

