#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/lib/noise/noise3d.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/ray_sphere.glsl
#include lomo:shaders/lib/hash.glsl

/* lomo:lib/sky.glsl */

struct layer {
	vec3 pos;
	float bottom;
	float height;
};

vec2 ray_layer_intersection(ray r, layer l) {
	sphere top_sphere = sphere(l.pos, l.bottom + l.height);
	sphere bot_sphere = sphere(l.pos, l.bottom);
	
	ray_sphere_intersection_result top = ray_sphere_intersection(r, top_sphere);

	if(top.success && top.far > 0) {
		return vec2(0.0, top.far);
	}
	
	return vec2(0.0, 0.0);
}

const uint DENSITY_EXPONENTIAL = 0;
const uint DENSITY_CLOUDS = 1;

float density_ratio(float h, layer l) {
	return exp(-(h/l.height));
}

float density_ratio(vec3 point, layer l) {
	return density_ratio(distance(point, l.pos) - l.bottom, l);
}

float density_clouds(vec3 point, layer l) {
	return 10.0;
}

float density(vec3 point, layer l, uint type) {
	if(type == DENSITY_EXPONENTIAL) {
		return density_ratio(point, l);
	}
	if(type == DENSITY_CLOUDS) {
		return density_clouds(point, l);
	}

	return -1.0;
}

const int steps = 1;

float od_integration(vec3 po, vec3 dir, float dist, layer l, uint density_type) {
	float stp = dist / float(steps);
	po += dir * stp / 2.0;

	float result = 0;

	for(int i = 0; i < steps; ++i) {
		result += density(po, l, density_type) * stp;
		po += dir * stp;
	}

	return result;
}

vec3 resulting_attenuation(ray r, vec3 star_dir, layer l, vec3 coeffs, uint density_type) {
	vec2 range = ray_layer_intersection(r, l);
	float dist = range[1] - range[0];

	float stp = dist / float(steps);
	dist = stp / 2.0;

	vec3 result = vec3(0);

	for(int i = 0; i < steps; ++i) {
		ray r0 = ray(r.pos + r.dir * dist, star_dir);
		vec2 range0 = ray_layer_intersection(r0, l);
		float dist0 = range0[1] - range0[0];

		result +=
			exp(
				-coeffs * (
					od_integration(r0.pos, star_dir, dist0, l, density_type)
					+
					od_integration(r.pos, r.dir, dist, l, density_type)
				)
			) * stp;

		dist += stp;
	};

	return result * coeffs;
}

vec3 sun_dir() {
	float t = frx_skyAngleRadians + 3.14 / 2.0;
	return vec3(cos(t), sin(t), 0);
}

vec3 sky_color(vec3 dir) {
	vec3 eye_pos = vec3(0.0, 6.0, 0.0) + frx_cameraPos / 1000000.0;

	ray eye = ray(eye_pos, dir);

	float a = dot(dir, sun_dir());
	vec3 rgb = pow(vec3(7.2, 5.7, 4.2), vec3(4.0));

	vec3 color = resulting_attenuation(
		eye,
		sun_dir(),
		layer(vec3(0.0), 6.0, 0.01),
		3000.0/rgb,
		DENSITY_EXPONENTIAL
	);

	float sun = 0.0;
	float sun_a = 0.9999;
	float h = 0.0003;
	
	if(a > sun_a) {
		sun = 1.0;
	}
	else if(a > sun_a - h) {
		sun= (a - (sun_a - h)) / h;
	}

	color += color * vec3(10.0, 5.0, 1.0) * 20 * sun;
	return color * 10.0;
	//return vec3(0.0, 1.0, 2.0) + sun;
}

vec3 fog_color(vec3 eye_offset) {
	vec3 eye_pos = vec3(0, 6.0, 0.0) + (eye_offset + frx_cameraPos) / 1000000.0;

	ray eye = ray(eye_pos, sun_dir());

	vec3 rgb = pow(vec3(7.2, 5.7, 4.2), vec3(4.0));

	vec3 color = resulting_attenuation(
		eye,
		sun_dir(),
		layer(vec3(0.0), 6.0, 0.0002),
		vec3(500.0/rgb),
		DENSITY_CLOUDS
	);

	return color * 10.;
}