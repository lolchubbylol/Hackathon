from skyfield.api import load, EarthSatellite, wgs84
from sgp4.earth_gravity import wgs84 as sgp4_wgs84
from sgp4.io import twoline2rv
import numpy as np
import datetime
import math
import os

# Function to load TLE data from a file
def load_tle_data(filename):
    satellites = []
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        if line and not line.startswith('#'):
            # Check if this is a name line
            if not (line.startswith('1 ') or line.startswith('2 ')):
                name = line
                # Make sure we have two more lines for the TLE
                if i + 2 < len(lines):
                    line1 = lines[i+1].strip()
                    line2 = lines[i+2].strip()
                    
                    if line1.startswith('1 ') and line2.startswith('2 '):
                        satellites.append({
                            "name": name,
                            "line1": line1,
                            "line2": line2
                        })
                        i += 3
                        continue
            
            # If we didn't continue, this might be line1 of a TLE without a name
            if line.startswith('1 ') and i + 1 < len(lines):
                line2 = lines[i+1].strip()
                if line2.startswith('2 '):
                    # Extract satellite number from line1
                    sat_num = line[2:7].strip()
                    satellites.append({
                        "name": f"SATELLITE-{sat_num}",
                        "line1": line,
                        "line2": line2
                    })
                    i += 2
                    continue
        
        # If we didn't continue, move to the next line
        i += 1
    
    return satellites

# Create a satellite object from TLE data
def create_satellite_from_tle(line1, line2, name):
    return {
        "name": name,
        "line1": line1,
        "line2": line2
    }

# Calculate positions of a list of satellites over time
def calculate_positions(satellites, start_time, end_time, step_minutes=10):
    ts = load.timescale()
    
    # Create time points
    time_points = []
    current_time = start_time
    while current_time <= end_time:
        time_points.append(current_time)
        current_time += datetime.timedelta(minutes=step_minutes)
    
    # Convert time points to skyfield time objects
    sf_times = [ts.utc(t.year, t.month, t.day, t.hour, t.minute, t.second) for t in time_points]
    
    results = []
    for sat_data in satellites:
        # Create skyfield satellite object
        satellite = EarthSatellite(sat_data["line1"], sat_data["line2"], sat_data["name"])
        
        positions = []
        for i, t in enumerate(sf_times):
            try:
                # Calculate position at this time
                geocentric = satellite.at(t)
                subpoint = wgs84.subpoint(geocentric)
                
                # Get position data
                lat = subpoint.latitude.degrees
                lon = subpoint.longitude.degrees
                alt = subpoint.elevation.km
                
                # Get ECI position for visibility calculations
                pos = geocentric.position.km
                
                positions.append({
                    'time': time_points[i].isoformat(),
                    'lat': lat,
                    'lon': lon,
                    'alt': alt,
                    'x': pos[0],
                    'y': pos[1],
                    'z': pos[2]
                })
            except Exception as e:
                # Skip any timepoints that cause errors
                print(f"Error calculating position for {sat_data['name']} at {t}: {e}")
        
        results.append({
            'name': sat_data["name"],
            'positions': positions
        })
    
    return results

# Calculate visibility windows between two satellites
def calculate_visibility(sat1_positions, sat2_positions, max_distance_km=2500):
    """Calculate when two satellites can communicate based on distance."""
    visibility_windows = []
    start_window = None
    
    # Make sure we're comparing positions at the same time points
    for i, pos1 in enumerate(sat1_positions):
        if i >= len(sat2_positions):
            break
            
        pos2 = sat2_positions[i]
        time = datetime.datetime.fromisoformat(pos1['time'])
        
        # Calculate distance between satellites
        dx = pos1['x'] - pos2['x']
        dy = pos1['y'] - pos2['y']
        dz = pos1['z'] - pos2['z']
        distance = math.sqrt(dx*dx + dy*dy + dz*dz)
        
        # Check if within communication range
        if distance <= max_distance_km:
            if start_window is None:
                start_window = time
        elif start_window is not None:
            # We've exited a visibility window
            visibility_windows.append({
                'start': start_window.isoformat(),
                'end': time.isoformat(),
                'duration_minutes': (time - start_window).total_seconds() / 60
            })
            start_window = None
    
    # Handle case where we're still in a window at the end
    if start_window is not None:
        end_time = datetime.datetime.fromisoformat(sat1_positions[-1]['time'])
        visibility_windows.append({
            'start': start_window.isoformat(),
            'end': end_time.isoformat(),
            'duration_minutes': (end_time - start_window).total_seconds() / 60
        })
    
    return visibility_windows

# Create a sun-synchronous orbit TLE
def create_sun_synchronous_orbit(altitude_km=700, inclination=None, ltan_hour=10.5):
    """
    Create a sun-synchronous orbit TLE
    
    If inclination is None, it will be calculated based on altitude
    LTAN = Local Time of Ascending Node (in hours, e.g. 10:30 = 10.5)
    """
    # Calculate inclination if not provided
    if inclination is None:
        # Formula for sun-synchronous inclination based on altitude
        earth_radius = 6378.137  # km
        earth_mu = 398600.4418  # km^3/s^2
        j2 = 0.00108263
        
        semi_major_axis = earth_radius + altitude_km
        orbit_period = 2 * math.pi * math.sqrt(semi_major_axis**3 / earth_mu)
        
        # Required nodal precession for sun-synchronous
        nodal_precession = 2 * math.pi / 365.2422 / 86400  # rad/s
        
        # Calculate inclination
        term = nodal_precession * orbit_period * (semi_major_axis / earth_radius)**2
        term = term / (-3 * math.pi * j2)
        inclination = math.degrees(math.acos(term))
    
    # Calculate orbital period in minutes
    earth_radius = 6378.137  # km
    earth_mu = 398600.4418  # km^3/s^2
    semi_major_axis = earth_radius + altitude_km
    orbit_period_sec = 2 * math.pi * math.sqrt(semi_major_axis**3 / earth_mu)
    orbit_period_min = orbit_period_sec / 60
    
    # Calculate mean motion (revolutions per day)
    mean_motion = 1440 / orbit_period_min
    
    # Calculate right ascension of ascending node based on LTAN
    # LTAN is converted to degrees (0-360)
    raan = (ltan_hour / 24) * 360
    
    # Generate simplified TLE
    # These are approximate values that would need refinement for real use
    line1 = f"1 99999U 20999A   25137.00000000  .00000000  00000-0  00000-0 0    01"
    line2 = f"2 99999 {inclination:8.4f} {raan:8.4f} 0001000 000.0000 000.0000 {mean_motion:11.8f}0    06"
    
    return line1, line2

# Create a non-polar orbit TLE
def create_non_polar_orbit(altitude_km=500, inclination=45, ascending_node=0):
    """Create a non-polar orbit with specified parameters"""
    # Calculate orbital period in minutes
    earth_radius = 6378.137  # km
    earth_mu = 398600.4418  # km^3/s^2
    semi_major_axis = earth_radius + altitude_km
    orbit_period_sec = 2 * math.pi * math.sqrt(semi_major_axis**3 / earth_mu)
    orbit_period_min = orbit_period_sec / 60
    
    # Calculate mean motion (revolutions per day)
    mean_motion = 1440 / orbit_period_min
    
    # Generate simplified TLE
    line1 = f"1 88888U 20888A   25137.00000000  .00000000  00000-0  00000-0 0    07"
    line2 = f"2 88888 {inclination:8.4f} {ascending_node:8.4f} 0001000 000.0000 000.0000 {mean_motion:11.8f}0    00"
    
    return line1, line2
