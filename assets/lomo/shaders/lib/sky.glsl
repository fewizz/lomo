#include frex:shaders/api/header.glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/view.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/ray_sphere.glsl

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

float density_ratio(float h, layer l) {
	return exp(-(h/l.height));
}

float density_ratio(vec3 point, layer l) {
	return density_ratio(distance(point, l.pos) - l.bottom, l);
}

const int steps = 3;

float od_integration(vec3 po, vec3 dir, float dist, layer l) {
	float stp = dist / float(steps);
	po += dir * stp / 2.0;

	float result = 0;

	for(int i = 0; i < steps; ++i) {
		result += density_ratio(po, l) * stp;
		po += dir * stp;
	}

	return result;
}

vec3 resulting_attenuation(ray v, vec3 star_dir, layer l, vec3 coeffs) {
	vec2 range = ray_layer_intersection(v, l);
	float dist = range[1] - range[0];

	float stp = dist / float(steps);

	dist -= stp / 2.0;

	vec3 result = vec3(0);

	for(int i = 0; i < steps; ++i) {
		vec3 pos0 = v.pos + v.dir * dist;
		ray r = ray(pos0, star_dir);
		vec2 range0 = ray_layer_intersection(r, l);
		float dist0 = range0[1] - range0[0];

		result +=
			exp(
				-coeffs * (
					od_integration(pos0, star_dir, dist0, l)
					+
					od_integration(v.pos, v.dir, dist, l)
				)
			) * stp;

		dist -= stp;
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
		2000.0/rgb
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
	sun*= 15.0;
	color += color * vec3(10.0, 5.0, 1.0) * sun;

	return color * 10.;
}

vec3 fog_color(vec3 eye_offset) {
	vec3 eye_pos = vec3(0, 6.0, 0.0) + (eye_offset + frx_cameraPos) / 1000000.0;

	ray eye = ray(eye_pos, sun_dir());

	vec3 rgb = pow(vec3(7.2, 5.7, 4.2), vec3(4.0));

	vec3 color = resulting_attenuation(
		eye,
		sun_dir(),
		layer(vec3(0.0), 6.0, 0.0001),
		vec3(2000.0/rgb)
	);

	return color * 10.;
}