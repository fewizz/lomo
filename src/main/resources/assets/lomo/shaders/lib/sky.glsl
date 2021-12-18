#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/view.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/math.glsl
#include lomo:shaders/lib/ray_sphere.glsl

/* lomo:lib/sky.glsl */

struct planet {
	vec3 pos;
	float rad;
	float atmos_h;
};

ray_sphere_intersection_result ray_planet_path(ray r,  planet p, bool to_star) {
	sphere atmosphere = sphere(p.pos, p.rad + p.atmos_h);
	sphere planet_sphere = sphere(p.pos, p.rad);
	
	ray_sphere_intersection_result atmos_dist = ray_sphere_intersection(r, atmosphere);
	ray_sphere_intersection_result planet_dist = ray_sphere_intersection(r, planet_sphere);

	if(planet_dist.success) {
		if(planet_dist.close < 0. && planet_dist.far > 0.)
			return ray_sphere_intersection_result(true, 0.0, atmos_dist.far);
			
		if(planet_dist.close > 0.)
			return ray_sphere_intersection_result(true, max(atmos_dist.close, 0.), to_star ? atmos_dist.far : planet_dist.close);
		if(atmos_dist.far > 0.)
			return ray_sphere_intersection_result(true, max(planet_dist.far, 0.), atmos_dist.far);
	}
	else {
		return ray_sphere_intersection_result(true, max(atmos_dist.close, 0.), atmos_dist.far);
	}
	
	return ray_sphere_intersection_result(false, 0.0, 0.0);
}

float density_ratio(float h, float H) {
	return exp(-h/H);
}

float density_ratio(vec3 point, planet p) {
	return density_ratio(distance(point, p.pos) - p.rad, p.atmos_h);
}

const int sky_steps = 3;

vec3 od_integration(vec3 po, vec3 dir, float dist, planet p) {
	float stp = dist / float(sky_steps);
	vec3 result = vec3(0.0);
	
	po += dir * stp / 2.0;
	
	for(int i = 0; i < sky_steps; i++) {
		result += density_ratio(po, p) * stp;
		po += dir * stp;
	}
	
	return result;
}

float henyey_greenstein_phase_function(float g, float cosa) {
	return 3.0*(1.0-g*g)/(2.0*(2.0+g*g)) * (1.0+cosa*cosa)/pow(1.0+g*g-2.0*g*cosa, 3.0/2.0);
}

const planet earth = planet(
	vec3(0.0),     // pos
	6.,           // earth_rad
	0.06          // atmos_h
);

vec3 resulting_attenuation(ray v, float dist, vec3 star_dir, planet p, vec3 coeffs, float phase) {
	vec3 result = vec3(0.0);
	
	float path = 0.0;
	float stp = dist / float(sky_steps);
	
	ray begin = v;
	v.pos += v.dir * (stp / 2.0);
	
	for(int i = 0; i < sky_steps; i++) {
		ray r0 = ray(v.pos, star_dir);
		ray_sphere_intersection_result pl_p0 = ray_planet_path(r0, earth, true);
		
		result +=
			exp(
				-density_ratio(v.pos, p)
				-coeffs * (
					od_integration(v.pos, star_dir, pl_p0.far, p) +
					od_integration(begin.pos, v.dir, path, p)
				)
			)
			* stp;
		
		path += stp;
		v.pos += v.dir * stp;
	}
	
	return phase*coeffs*result;
}

vec3 resulting_attenuation(ray v, vec3 star_dir, planet p, vec3 coeffs, float phase, float max_dist) {
	ray_sphere_intersection_result pl_p = ray_planet_path(v, earth, false);

	float dist = (pl_p.far - pl_p.close);
	v.pos += v.dir * pl_p.close;

	if(max_dist != -1) {
		dist = min(dist, max_dist);
	}

	return resulting_attenuation(v, dist, star_dir, p, coeffs, phase);
}

vec3 sky_color(vec3 dir, float dist) {
	float t = frx_skyAngleRadians + 3.14 / 2.0;
	vec3 sun_dir = vec3(cos(t), sin(t), 0);
	
	vec3 eye_pos = vec3(0, earth.rad + 0.01, 0.) + frx_cameraPos / 1000000.;

	ray eye = ray(eye_pos, dir);

	float a = dot(dir, sun_dir);
	vec3 rgb1 = vec3(7.2, 5.7, 4.2);
	vec3 rgb = pow3(rgb1, 4.0);

	// TODO rename "planet"
	planet molecules = planet(
		vec3(0.),
		earth.rad,
		0.08
	);

	planet aerosols = planet(
		vec3(0.0),
		earth.rad,
		0.012
	);

	vec3 color =
		vec3(2.5, 1.8, 4.0) *
		resulting_attenuation(eye, sun_dir, molecules, 10000.0/rgb, 1.0, dist) + 
		resulting_attenuation(eye, sun_dir, aerosols, vec3(1.0), henyey_greenstein_phase_function(0.2, a), dist)
	;

	if(dist == -1) {
		color +=
			resulting_attenuation(eye, sun_dir, aerosols, rgb/100000.0, henyey_greenstein_phase_function(0.97, a), dist);
	}

	return color;
}


vec3 sky_color(vec3 dir) {
	return sky_color(dir, -1);
}